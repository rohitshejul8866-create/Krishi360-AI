import type { AuthUser } from '../middleware/auth';
import type { Farm, IrrigationRecommendation, Plot, SoilReading, WeatherContext } from '../models/farm';
import type { FarmRepository } from '../repositories/types';
import { NotFoundError, ValidationError } from '../utils/errors';
import { makeId, nowIso } from '../utils/ids';
import type { Page, PageRequest } from '../utils/pagination';
import type { Logger } from '../utils/logger';
import type { AuditService } from './auditService';

export interface FarmCreateInput {
  name: string;
  location: string;
  areaHa: number;
  soilType: string;
  irrigationType: string;
  plots: Array<Omit<Plot, 'id'>>;
}

export interface SoilReadingInput {
  plotId: string;
  soilMoisture: number;
  source: 'manual' | 'simulated';
  weather?: WeatherContext;
  notes?: string;
}

/** Relative water need by crop — demo agronomy constants, not live advice. */
const CROP_NEED: Record<string, number> = {
  Tomato: 1.05,
  Wheat: 0.9,
  Grapes: 0.72,
  Onion: 0.68,
  Rice: 1.35,
  Cotton: 0.95,
  Maize: 0.92,
  Potato: 0.86,
};

const STAGE_FACTOR: Record<string, number> = {
  Seedling: 0.65,
  Vegetative: 0.9,
  Flowering: 1.15,
  'Fruit / grain formation': 1.2,
  Maturity: 0.55,
};

/**
 * Rule-based irrigation estimate aligned with the frontend demo rules.
 * Always advisory: based only on the values supplied, never on live telemetry.
 */
export function recommendIrrigation(input: {
  crop: string;
  stage: string;
  soilType: string;
  moisture: number;
  weather?: WeatherContext;
}): IrrigationRecommendation {
  const weatherText = input.weather?.condition ?? 'Unknown';
  const temperature = input.weather?.temperatureC ?? 25;
  const hot = temperature >= 32;
  const dryWeather = ['Hot & dry', 'Sunny', 'Partly cloudy'].includes(weatherText);
  const rainExpected = weatherText.toLowerCase().includes('rain') || (input.weather?.rainfallMm ?? 0) > 5;
  const moisture = Math.min(100, Math.max(0, input.moisture));
  const sandy = input.soilType.toLowerCase().includes('sandy');
  const need = (CROP_NEED[input.crop] ?? 0.9) * (STAGE_FACTOR[input.stage] ?? 1);
  const threshold = sandy ? 40 : 34;

  let action: IrrigationRecommendation['action'] = 'hold';
  if (moisture < threshold - 8 || (hot && dryWeather && moisture < threshold)) action = 'irrigate-now';
  else if (moisture < threshold + 8 && !rainExpected) action = 'schedule';

  const baseLitres = Math.round(4200 * need * (action === 'irrigate-now' ? 1 : action === 'schedule' ? 0.7 : 0.25));
  const waterLitres = Math.max(900, baseLitres);
  const durationMin = Math.round(waterLitres / 145);

  return {
    headline:
      action === 'irrigate-now'
        ? 'Irrigation suggested soon'
        : action === 'schedule'
          ? 'Schedule a lighter irrigation'
          : 'Hold irrigation for now',
    action,
    waterLitres,
    durationMin,
    bestWindow: action === 'hold' ? 'Reassess in 24 hours' : 'Early morning or late evening',
    reasoning: [
      `Soil moisture is ${moisture}%. ${sandy ? 'Sandy soils drain faster, so the threshold is higher (40%).' : 'The default threshold is 34% for this soil group.'}`,
      `${input.crop} at ${input.stage.toLowerCase()} stage has a relative water need of ${need.toFixed(2)}x in this model.`,
      rainExpected
        ? 'Rain is indicated in the supplied weather context, so irrigation can be deferred.'
        : hot
          ? 'High temperature increases evapotranspiration.'
          : 'Weather context does not indicate immediate rainfall.',
      `Soil type: ${input.soilType}.`,
    ],
    confidenceNote:
      'Advisory estimate derived only from the values you entered. Verify with field observation; simulated readings are not field measurements.',
  };
}

export class JalSenseService {
  constructor(private repo: FarmRepository, private audit: AuditService) {}

  private assertAccess(user: AuthUser, farm: Farm): void {
    if (user.role === 'admin') return;
    if (farm.farmerId !== user.id) throw new NotFoundError('Farm not found.');
  }

  private async getAccessible(user: AuthUser, id: string): Promise<Farm> {
    const farm = await this.repo.get(id);
    if (!farm) throw new NotFoundError('Farm not found.');
    this.assertAccess(user, farm);
    return farm;
  }

  async createFarm(user: AuthUser, input: FarmCreateInput, logger: Logger): Promise<Farm> {
    const ts = nowIso();
    const farm: Farm = {
      id: makeId('FARM'),
      farmerId: user.id,
      name: input.name,
      location: input.location,
      areaHa: input.areaHa,
      soilType: input.soilType,
      irrigationType: input.irrigationType,
      plots: input.plots.map((p) => ({ ...p, id: makeId('PLOT') })),
      createdAt: ts,
      updatedAt: ts,
      version: 1,
    };
    await this.repo.create(farm);
    await this.audit.record(logger, user, 'farm.created', farm.id);
    return farm;
  }

  listFarms(user: AuthUser, page: PageRequest): Promise<Page<Farm>> {
    return user.role === 'admin' ? this.repo.listAll(page) : this.repo.listByOwner(user.id, page);
  }

  getFarm(user: AuthUser, id: string): Promise<Farm> {
    return this.getAccessible(user, id);
  }

  async addReading(user: AuthUser, farmId: string, input: SoilReadingInput, logger: Logger): Promise<SoilReading> {
    const farm = await this.getAccessible(user, farmId);
    const plot = farm.plots.find((p) => p.id === input.plotId);
    if (!plot) throw new ValidationError('plotId does not belong to this farm.');

    const reading: SoilReading = {
      id: makeId('READ'),
      farmId,
      plotId: input.plotId,
      soilMoisture: input.soilMoisture,
      source: input.source,
      ...(input.weather ? { weather: input.weather } : {}),
      ...(input.notes ? { notes: input.notes } : {}),
      recommendation: recommendIrrigation({
        crop: plot.crop,
        stage: plot.growthStage,
        soilType: farm.soilType,
        moisture: input.soilMoisture,
        ...(input.weather ? { weather: input.weather } : {}),
      }),
      recordedBy: user.id,
      createdAt: nowIso(),
    };
    await this.repo.addReading(reading);
    await this.audit.record(logger, user, 'farm.reading_added', farmId, { plotId: input.plotId, source: input.source });
    return reading;
  }

  async listReadings(user: AuthUser, farmId: string, plotId: string | undefined, page: PageRequest): Promise<Page<SoilReading>> {
    await this.getAccessible(user, farmId);
    return this.repo.listReadings(farmId, plotId, page);
  }
}