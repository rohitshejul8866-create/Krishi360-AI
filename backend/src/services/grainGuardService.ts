import type { AuthUser } from '../middleware/auth';
import type {
  Inspection,
  StorageAlert,
  StorageBatch,
  StorageReading,
  StorageStatus,
  StorageThresholds,
} from '../models/storage';
import type { StorageRepository } from '../repositories/types';
import { NotFoundError } from '../utils/errors';
import { makeId, nowIso } from '../utils/ids';
import type { Page, PageRequest } from '../utils/pagination';
import type { Logger } from '../utils/logger';
import type { AuditService } from './auditService';

export interface BatchCreateInput {
  code: string;
  crop: string;
  quantityKg: number;
  location: string;
  thresholds: StorageThresholds;
  initialReading?: { tempC: number; humidity: number; source: 'manual' | 'simulated' };
}

export interface StorageReadingInput {
  tempC: number;
  humidity: number;
  source: 'manual' | 'simulated';
}

/** Margins beyond a threshold that escalate an alert from warning to critical. */
export const CRITICAL_TEMP_MARGIN_C = 3;
export const CRITICAL_HUMIDITY_MARGIN = 8;

export interface EvaluatedAlert {
  type: StorageAlert['type'];
  severity: 'warning' | 'critical';
  message: string;
}

/** Pure threshold evaluation — unit-tested without any AWS dependency. */
export function evaluateReading(
  reading: { tempC: number; humidity: number },
  thresholds: StorageThresholds,
): EvaluatedAlert[] {
  const alerts: EvaluatedAlert[] = [];
  if (reading.tempC > thresholds.maxTempC) {
    alerts.push({
      type: 'temperature_high',
      severity: reading.tempC >= thresholds.maxTempC + CRITICAL_TEMP_MARGIN_C ? 'critical' : 'warning',
      message: `Temperature ${reading.tempC}°C exceeds the configured maximum of ${thresholds.maxTempC}°C.`,
    });
  }
  if (reading.tempC < thresholds.minTempC) {
    alerts.push({
      type: 'temperature_low',
      severity: reading.tempC <= thresholds.minTempC - CRITICAL_TEMP_MARGIN_C ? 'critical' : 'warning',
      message: `Temperature ${reading.tempC}°C is below the configured minimum of ${thresholds.minTempC}°C.`,
    });
  }
  if (reading.humidity > thresholds.maxHumidity) {
    alerts.push({
      type: 'humidity_high',
      severity: reading.humidity >= thresholds.maxHumidity + CRITICAL_HUMIDITY_MARGIN ? 'critical' : 'warning',
      message: `Humidity ${reading.humidity}% exceeds the configured maximum of ${thresholds.maxHumidity}%.`,
    });
  }
  return alerts;
}

export function statusFromAlerts(alerts: EvaluatedAlert[]): StorageStatus {
  if (alerts.some((a) => a.severity === 'critical')) return 'critical';
  if (alerts.length > 0) return 'warning';
  return 'normal';
}

export class GrainGuardService {
  constructor(private repo: StorageRepository, private audit: AuditService) {}

  private assertAccess(user: AuthUser, batch: StorageBatch): void {
    if (user.role === 'admin') return;
    if (batch.ownerId !== user.id) throw new NotFoundError('Storage batch not found.');
  }

  private async getAccessible(user: AuthUser, id: string): Promise<StorageBatch> {
    const batch = await this.repo.getBatch(id);
    if (!batch) throw new NotFoundError('Storage batch not found.');
    this.assertAccess(user, batch);
    return batch;
  }

  async createBatch(user: AuthUser, input: BatchCreateInput, logger: Logger): Promise<StorageBatch> {
    const ts = nowIso();
    const evaluated = input.initialReading ? evaluateReading(input.initialReading, input.thresholds) : [];
    const batch: StorageBatch = {
      id: makeId('BATCH'),
      ownerId: user.id,
      code: input.code,
      crop: input.crop,
      quantityKg: input.quantityKg,
      location: input.location,
      thresholds: input.thresholds,
      ...(input.initialReading
        ? { currentReading: { ...input.initialReading, recordedAt: ts } }
        : {}),
      status: statusFromAlerts(evaluated),
      createdAt: ts,
      updatedAt: ts,
      version: 1,
    };
    await this.repo.createBatch(batch);
    if (input.initialReading) {
      const reading: StorageReading = {
        id: makeId('SREAD'),
        batchId: batch.id,
        ...input.initialReading,
        recordedBy: user.id,
        createdAt: ts,
      };
      await this.repo.addReading(reading);
      await this.persistAlerts(batch.id, reading.id, evaluated);
    }
    await this.audit.record(logger, user, 'storage.batch_created', batch.id, { crop: batch.crop });
    return batch;
  }

  listBatches(user: AuthUser, page: PageRequest): Promise<Page<StorageBatch>> {
    return user.role === 'admin' ? this.repo.listAll(page) : this.repo.listByOwner(user.id, page);
  }

  async getBatch(user: AuthUser, id: string): Promise<{ batch: StorageBatch; inspections: Inspection[] }> {
    const batch = await this.getAccessible(user, id);
    const inspections = await this.repo.listInspections(id);
    return { batch, inspections };
  }

  private async persistAlerts(batchId: string, readingId: string, evaluated: EvaluatedAlert[]): Promise<StorageAlert[]> {
    const alerts: StorageAlert[] = evaluated.map((e) => ({
      id: makeId('ALERT'),
      batchId,
      type: e.type,
      severity: e.severity,
      message: e.message,
      readingId,
      status: 'open',
      createdAt: nowIso(),
    }));
    for (const alert of alerts) await this.repo.addAlert(alert);
    return alerts;
  }

  async addReading(
    user: AuthUser,
    batchId: string,
    input: StorageReadingInput,
    logger: Logger,
  ): Promise<{ reading: StorageReading; alerts: StorageAlert[]; batchStatus: StorageStatus }> {
    const batch = await this.getAccessible(user, batchId);
    const ts = nowIso();
    const reading: StorageReading = {
      id: makeId('SREAD'),
      batchId,
      tempC: input.tempC,
      humidity: input.humidity,
      source: input.source,
      recordedBy: user.id,
      createdAt: ts,
    };
    await this.repo.addReading(reading);

    const evaluated = evaluateReading(reading, batch.thresholds);
    const alerts = await this.persistAlerts(batchId, reading.id, evaluated);
    const status = statusFromAlerts(evaluated);

    const updated: StorageBatch = {
      ...batch,
      currentReading: { tempC: input.tempC, humidity: input.humidity, source: input.source, recordedAt: ts },
      status,
      updatedAt: ts,
      version: batch.version + 1,
    };
    await this.repo.updateBatch(updated, batch.version);
    if (alerts.length > 0) {
      await this.audit.record(logger, user, 'storage.alerts_raised', batchId, { count: alerts.length, status });
    }
    return { reading, alerts, batchStatus: status };
  }

  async listAlerts(user: AuthUser, batchId: string, page: PageRequest): Promise<Page<StorageAlert>> {
    await this.getAccessible(user, batchId);
    return this.repo.listAlerts(batchId, page);
  }

  async listReadings(user: AuthUser, batchId: string, page: PageRequest): Promise<Page<StorageReading>> {
    await this.getAccessible(user, batchId);
    return this.repo.listReadings(batchId, page);
  }

  async addInspection(
    user: AuthUser,
    batchId: string,
    input: { notes: string; condition: StorageStatus },
    logger: Logger,
  ): Promise<Inspection> {
    await this.getAccessible(user, batchId);
    const inspection: Inspection = {
      id: makeId('INSP'),
      batchId,
      inspectorId: user.id,
      ...(user.name ? { inspectorName: user.name } : {}),
      notes: input.notes,
      condition: input.condition,
      createdAt: nowIso(),
    };
    await this.repo.addInspection(inspection);
    await this.audit.record(logger, user, 'storage.inspection_added', batchId, { condition: input.condition });
    return inspection;
  }
}