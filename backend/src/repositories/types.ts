/**
 * Repository interfaces. Services depend ONLY on these interfaces, which lets
 * unit tests and the local dev server run without any AWS resources.
 */

import type { Role } from '../middleware/auth';
import type { AuditEntry } from '../models/audit';
import type { CaseStatus, CropCase } from '../models/cropCase';
import type { Farm, SoilReading } from '../models/farm';
import type { MandiPrice } from '../models/mandi';
import type { Scheme } from '../models/scheme';
import type { Inspection, StorageAlert, StorageBatch, StorageReading } from '../models/storage';
import type { UserAccount } from '../models/user';
import type { Page, PageRequest } from '../utils/pagination';

export interface CropCaseRepository {
  create(item: CropCase): Promise<void>;
  get(id: string): Promise<CropCase | null>;
  /** Conditional write; throws ConflictError on version mismatch. */
  update(item: CropCase, expectedVersion: number): Promise<void>;
  listByFarmer(farmerId: string, page: PageRequest, status?: CaseStatus): Promise<Page<CropCase>>;
  /** Cases assigned to the expert plus the unassigned review queue. */
  listForExpert(expertId: string, page: PageRequest, status?: CaseStatus): Promise<Page<CropCase>>;
  listAll(page: PageRequest, status?: CaseStatus): Promise<Page<CropCase>>;
}

export interface MandiFilters {
  crop?: string;
  state?: string;
  district?: string;
  mandi?: string;
  date?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface MandiRepository {
  put(item: MandiPrice): Promise<void>;
  get(id: string): Promise<MandiPrice | null>;
  query(filters: MandiFilters, page: PageRequest): Promise<Page<MandiPrice>>;
}

export interface FarmRepository {
  create(item: Farm): Promise<void>;
  get(id: string): Promise<Farm | null>;
  update(item: Farm, expectedVersion: number): Promise<void>;
  listByOwner(ownerId: string, page: PageRequest): Promise<Page<Farm>>;
  listAll(page: PageRequest): Promise<Page<Farm>>;
  addReading(reading: SoilReading): Promise<void>;
  listReadings(farmId: string, plotId: string | undefined, page: PageRequest): Promise<Page<SoilReading>>;
}

export interface StorageRepository {
  createBatch(item: StorageBatch): Promise<void>;
  getBatch(id: string): Promise<StorageBatch | null>;
  updateBatch(item: StorageBatch, expectedVersion: number): Promise<void>;
  listByOwner(ownerId: string, page: PageRequest): Promise<Page<StorageBatch>>;
  listAll(page: PageRequest): Promise<Page<StorageBatch>>;
  addReading(reading: StorageReading): Promise<void>;
  addAlert(alert: StorageAlert): Promise<void>;
  listAlerts(batchId: string, page: PageRequest): Promise<Page<StorageAlert>>;
  addInspection(inspection: Inspection): Promise<void>;
  listInspections(batchId: string): Promise<Inspection[]>;
}

export interface SchemeFilters {
  q?: string;
  category?: string;
  state?: string;
}

export interface SchemeRepository {
  put(item: Scheme): Promise<void>;
  get(id: string): Promise<Scheme | null>;
  list(filters: SchemeFilters, page: PageRequest): Promise<Page<Scheme>>;
}

export interface AuditRepository {
  put(entry: AuditEntry): Promise<void>;
  list(page: PageRequest, actorId?: string): Promise<Page<AuditEntry>>;
}

export interface UserRepository {
  create(item: UserAccount): Promise<void>;
  get(id: string): Promise<UserAccount | null>;
  getByEmail(email: string): Promise<UserAccount | null>;
  update(item: UserAccount, expectedVersion: number): Promise<void>;
  list(page: PageRequest, role?: Role): Promise<Page<UserAccount>>;
}