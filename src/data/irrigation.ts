import type { IrrigationRecord, IrrigationSchedule } from '../types'

export const DEMO_IRRIGATION_HISTORY: IrrigationRecord[] = [
  { id: 'ir-01', plotId: 'plot-a', crop: 'Tomato', date: '2026-11-20', durationMin: 42, waterLitres: 6300, method: 'Drip', moistureBefore: 31, moistureAfter: 46 },
  { id: 'ir-02', plotId: 'plot-b', crop: 'Wheat', date: '2026-11-19', durationMin: 55, waterLitres: 8800, method: 'Canal + sprinkler', moistureBefore: 24, moistureAfter: 39 },
  { id: 'ir-03', plotId: 'plot-c', crop: 'Grapes', date: '2026-11-21', durationMin: 30, waterLitres: 4500, method: 'Drip', moistureBefore: 36, moistureAfter: 48 },
  { id: 'ir-04', plotId: 'plot-d', crop: 'Onion', date: '2026-11-17', durationMin: 35, waterLitres: 5200, method: 'Drip', moistureBefore: 21, moistureAfter: 34 },
  { id: 'ir-05', plotId: 'plot-a', crop: 'Tomato', date: '2026-11-14', durationMin: 40, waterLitres: 6000, method: 'Drip', moistureBefore: 29, moistureAfter: 44 },
  { id: 'ir-06', plotId: 'plot-b', crop: 'Wheat', date: '2026-11-12', durationMin: 58, waterLitres: 9200, method: 'Canal + sprinkler', moistureBefore: 22, moistureAfter: 37 },
]

export const DEMO_IRRIGATION_SCHEDULE: IrrigationSchedule[] = [
  { id: 'sch-01', plot: 'Plot A — North Field', crop: 'Tomato', stage: 'Flowering', nextDate: '2026-11-23', reminder: true },
  { id: 'sch-02', plot: 'Plot B — East Field', crop: 'Wheat', stage: 'Tillering', nextDate: '2026-11-24', reminder: true },
  { id: 'sch-03', plot: 'Plot C — Orchard', crop: 'Grapes', stage: 'Berry development', nextDate: '2026-11-26', reminder: false },
]

export const DEMO_WATER_USAGE = [
  { day: '15 Nov', litres: 18400 },
  { day: '16 Nov', litres: 12100 },
  { day: '17 Nov', litres: 15200 },
  { day: '18 Nov', litres: 9800 },
  { day: '19 Nov', litres: 16800 },
  { day: '20 Nov', litres: 14300 },
  { day: '21 Nov', litres: 10800 },
]

export const DEMO_WEATHER = {
  condition: 'Partly cloudy',
  temperatureC: 29,
  humidityPct: 56,
  forecastRainMm: 2.4,
  windKmh: 12,
  source: 'Simulated weather context',
}
