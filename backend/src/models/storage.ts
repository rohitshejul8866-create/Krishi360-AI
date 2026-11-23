/** GrainGuard domain models. */

import type { ReadingSource } from './farm';

export type StorageStatus = 'normal' | 'warning' | 'critical';

export interface StorageThresholds {
  minTempC: number;
  maxTempC: number;
  maxHumidity: number;
}

export interface StorageBatch {
  id: string;
  ownerId: string;
  code: string;
  crop: string;
  quantityKg: number;
  location: string;
  thresholds: StorageThresholds;
  currentReading?: { tempC: number; humidity: number; source: ReadingSource; recordedAt: string };
  status: StorageStatus;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface StorageReading {
  id: string;
  batchId: string;
  tempC: number;
  humidity: number;
  source: ReadingSource;
  recordedBy: string;
  createdAt: string;
}

export type AlertType = 'temperature_high' | 'temperature_low' | 'humidity_high';

export interface StorageAlert {
  id: string;
  batchId: string;
  type: AlertType;
  severity: 'warning' | 'critical';
  message: string;
  readingId: string;
  status: 'open' | 'acknowledged';
  createdAt: string;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
}

export interface Inspection {
  id: string;
  batchId: string;
  inspectorId: string;
  inspectorName?: string;
  notes: string;
  condition: StorageStatus;
  createdAt: string;
}