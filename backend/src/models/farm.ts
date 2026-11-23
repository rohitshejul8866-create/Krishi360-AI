/** JalSense domain models. */

export interface Plot {
  id: string;
  name: string;
  areaHa: number;
  crop: string;
  growthStage: string;
}

export interface Farm {
  id: string;
  farmerId: string;
  name: string;
  location: string;
  areaHa: number;
  soilType: string;
  irrigationType: string;
  plots: Plot[];
  createdAt: string;
  updatedAt: string;
  version: number;
}

export type ReadingSource = 'manual' | 'simulated';

export interface WeatherContext {
  condition: string;
  temperatureC?: number;
  rainfallMm?: number;
}

export interface IrrigationRecommendation {
  headline: string;
  action: 'irrigate-now' | 'schedule' | 'hold';
  waterLitres: number;
  durationMin: number;
  bestWindow: string;
  reasoning: string[];
  confidenceNote: string;
}

export interface SoilReading {
  id: string;
  farmId: string;
  plotId: string;
  soilMoisture: number;
  source: ReadingSource;
  weather?: WeatherContext;
  notes?: string;
  recommendation: IrrigationRecommendation;
  recordedBy: string;
  createdAt: string;
}