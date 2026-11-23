/**
 * In-memory repository implementations.
 *
 * Used ONLY by the local dev server and unit tests — never in Lambda
 * (loadConfig refuses DATA_BACKEND=memory there). They mirror the DynamoDB
 * access patterns (ownership scoping, newest-first ordering, cursor paging)
 * so behaviour stays consistent between local and deployed modes.
 */

import type { Role } from '../../middleware/auth';
import type { AuditEntry } from '../../models/audit';
import type { CaseStatus, CropCase } from '../../models/cropCase';
import type { Farm, SoilReading } from '../../models/farm';
import type { MandiPrice } from '../../models/mandi';
import type { Scheme } from '../../models/scheme';
import type { Inspection, StorageAlert, StorageBatch, StorageReading } from '../../models/storage';
import type { UserAccount } from '../../models/user';
import type { NotificationRecord, PlatformSettingsRecord, UserWorkspaceState } from '../../models/workspace';
import { ConflictError } from '../../utils/errors';
import { decodeCursor, encodeCursor, type Page, type PageRequest } from '../../utils/pagination';
import type {
  AuditRepository,
  CropCaseRepository,
  FarmRepository,
  MandiFilters,
  MandiRepository,
  SchemeFilters,
  SchemeRepository,
  StorageRepository,
  UserRepository,
  WorkspaceRepository,
} from '../types';

function paginate<T>(sorted: T[], page: PageRequest): Page<T> {
  const cursor = decodeCursor<{ offset: number }>(page.cursor);
  const offset = cursor?.offset ?? 0;
  const items = sorted.slice(offset, offset + page.limit);
  const next = offset + page.limit;
  return { items, nextToken: next < sorted.length ? encodeCursor({ offset: next }) : null };
}

const byNewest = <T extends { createdAt: string }>(a: T, b: T) => b.createdAt.localeCompare(a.createdAt);

export class MemoryCropCaseRepository implements CropCaseRepository {
  readonly items = new Map<string, CropCase>();

  async create(item: CropCase): Promise<void> {
    this.items.set(item.id, structuredClone(item));
  }
  async get(id: string): Promise<CropCase | null> {
    const found = this.items.get(id);
    return found ? structuredClone(found) : null;
  }
  async update(item: CropCase, expectedVersion: number): Promise<void> {
    const existing = this.items.get(item.id);
    if (!existing || existing.version !== expectedVersion) throw new ConflictError();
    this.items.set(item.id, structuredClone(item));
  }
  async listByFarmer(farmerId: string, page: PageRequest, status?: CaseStatus): Promise<Page<CropCase>> {
    const all = [...this.items.values()].filter((c) => c.farmerId === farmerId && (!status || c.status === status));
    return paginate(all.sort(byNewest), page);
  }
  async listForExpert(expertId: string, page: PageRequest, status?: CaseStatus): Promise<Page<CropCase>> {
    const queueStatuses = new Set(['new', 'ai_review', 'expert_review']);
    const all = [...this.items.values()].filter(
      (c) =>
        (c.assignedExpertId === expertId ||
          (c.assignedExpertId === undefined && queueStatuses.has(c.status))) &&
        (!status || c.status === status),
    );
    return paginate(all.sort(byNewest), page);
  }
  async listAll(page: PageRequest, status?: CaseStatus): Promise<Page<CropCase>> {
    const all = [...this.items.values()].filter((c) => !status || c.status === status);
    return paginate(all.sort(byNewest), page);
  }
}

export class MemoryMandiRepository implements MandiRepository {
  readonly items = new Map<string, MandiPrice>();

  async put(item: MandiPrice): Promise<void> {
    this.items.set(item.id, structuredClone(item));
  }
  async get(id: string): Promise<MandiPrice | null> {
    const found = this.items.get(id);
    return found ? structuredClone(found) : null;
  }
  async query(filters: MandiFilters, page: PageRequest): Promise<Page<MandiPrice>> {
    const all = [...this.items.values()].filter((p) => {
      if (filters.crop && p.crop !== filters.crop) return false;
      if (filters.state && p.state !== filters.state) return false;
      if (filters.district && p.district !== filters.district) return false;
      if (filters.mandi && p.mandi !== filters.mandi) return false;
      if (filters.date && p.date !== filters.date) return false;
      if (filters.dateFrom && p.date < filters.dateFrom) return false;
      if (filters.dateTo && p.date > filters.dateTo) return false;
      return true;
    });
    return paginate(all.sort((a, b) => b.date.localeCompare(a.date)), page);
  }
}

export class MemoryFarmRepository implements FarmRepository {
  readonly farms = new Map<string, Farm>();
  readonly readings: SoilReading[] = [];

  async create(item: Farm): Promise<void> {
    this.farms.set(item.id, structuredClone(item));
  }
  async get(id: string): Promise<Farm | null> {
    const found = this.farms.get(id);
    return found ? structuredClone(found) : null;
  }
  async update(item: Farm, expectedVersion: number): Promise<void> {
    const existing = this.farms.get(item.id);
    if (!existing || existing.version !== expectedVersion) throw new ConflictError();
    this.farms.set(item.id, structuredClone(item));
  }
  async listByOwner(ownerId: string, page: PageRequest): Promise<Page<Farm>> {
    return paginate([...this.farms.values()].filter((f) => f.farmerId === ownerId).sort(byNewest), page);
  }
  async listAll(page: PageRequest): Promise<Page<Farm>> {
    return paginate([...this.farms.values()].sort(byNewest), page);
  }
  async addReading(reading: SoilReading): Promise<void> {
    this.readings.push(structuredClone(reading));
  }
  async listReadings(farmId: string, plotId: string | undefined, page: PageRequest): Promise<Page<SoilReading>> {
    const all = this.readings.filter((r) => r.farmId === farmId && (!plotId || r.plotId === plotId));
    return paginate(all.sort(byNewest), page);
  }
}

export class MemoryStorageRepository implements StorageRepository {
  readonly batches = new Map<string, StorageBatch>();
  readonly readings: StorageReading[] = [];
  readonly alerts: StorageAlert[] = [];
  readonly inspections: Inspection[] = [];

  async createBatch(item: StorageBatch): Promise<void> {
    this.batches.set(item.id, structuredClone(item));
  }
  async getBatch(id: string): Promise<StorageBatch | null> {
    const found = this.batches.get(id);
    return found ? structuredClone(found) : null;
  }
  async updateBatch(item: StorageBatch, expectedVersion: number): Promise<void> {
    const existing = this.batches.get(item.id);
    if (!existing || existing.version !== expectedVersion) throw new ConflictError();
    this.batches.set(item.id, structuredClone(item));
  }
  async listByOwner(ownerId: string, page: PageRequest): Promise<Page<StorageBatch>> {
    return paginate([...this.batches.values()].filter((b) => b.ownerId === ownerId).sort(byNewest), page);
  }
  async listAll(page: PageRequest): Promise<Page<StorageBatch>> {
    return paginate([...this.batches.values()].sort(byNewest), page);
  }
  async addReading(reading: StorageReading): Promise<void> {
    this.readings.push(structuredClone(reading));
  }
  async listReadings(batchId: string, page: PageRequest): Promise<Page<StorageReading>> {
    return paginate(this.readings.filter((r) => r.batchId === batchId).sort(byNewest), page);
  }
  async addAlert(alert: StorageAlert): Promise<void> {
    this.alerts.push(structuredClone(alert));
  }
  async listAlerts(batchId: string, page: PageRequest): Promise<Page<StorageAlert>> {
    return paginate(this.alerts.filter((a) => a.batchId === batchId).sort(byNewest), page);
  }
  async addInspection(inspection: Inspection): Promise<void> {
    this.inspections.push(structuredClone(inspection));
  }
  async listInspections(batchId: string): Promise<Inspection[]> {
    return this.inspections.filter((i) => i.batchId === batchId).sort(byNewest);
  }
}

export class MemorySchemeRepository implements SchemeRepository {
  readonly items = new Map<string, Scheme>();

  async put(item: Scheme): Promise<void> {
    this.items.set(item.id, structuredClone(item));
  }
  async get(id: string): Promise<Scheme | null> {
    const found = this.items.get(id);
    return found ? structuredClone(found) : null;
  }
  async list(filters: SchemeFilters, page: PageRequest): Promise<Page<Scheme>> {
    const q = filters.q?.toLowerCase();
    const all = [...this.items.values()].filter((s) => {
      if (filters.category && s.category !== filters.category) return false;
      if (filters.state && s.state !== filters.state && s.state !== 'All India') return false;
      if (q && ![s.name, s.summary, s.category, ...s.tags].some((v) => v.toLowerCase().includes(q))) return false;
      return true;
    });
    return paginate(all.sort((a, b) => a.name.localeCompare(b.name)), page);
  }
}

export class MemoryAuditRepository implements AuditRepository {
  readonly entries: AuditEntry[] = [];

  async put(entry: AuditEntry): Promise<void> {
    this.entries.push(structuredClone(entry));
  }
  async list(page: PageRequest, actorId?: string): Promise<Page<AuditEntry>> {
    const all = this.entries.filter((e) => !actorId || e.actorId === actorId);
    return paginate(all.sort((a, b) => b.timestamp.localeCompare(a.timestamp)), page);
  }
}

export class MemoryUserRepository implements UserRepository {
  readonly users = new Map<string, UserAccount>();

  async create(item: UserAccount): Promise<void> {
    this.users.set(item.id, structuredClone(item));
  }
  async get(id: string): Promise<UserAccount | null> {
    const found = this.users.get(id);
    return found ? structuredClone(found) : null;
  }
  async getByEmail(email: string): Promise<UserAccount | null> {
    const target = email.trim().toLowerCase();
    for (const user of this.users.values()) {
      if (user.email.toLowerCase() === target) return structuredClone(user);
    }
    return null;
  }
  async update(item: UserAccount, expectedVersion: number): Promise<void> {
    const existing = this.users.get(item.id);
    if (!existing || existing.version !== expectedVersion) throw new ConflictError();
    this.users.set(item.id, structuredClone(item));
  }
  async list(page: PageRequest, role?: Role): Promise<Page<UserAccount>> {
    const all = [...this.users.values()].filter((u) => !role || u.role === role);
    return paginate(all.sort(byNewest), page);
  }
}

export class MemoryWorkspaceRepository implements WorkspaceRepository {
  readonly workspaces = new Map<string, UserWorkspaceState>();
  readonly notifications = new Map<string, NotificationRecord>();
  platformSettings: PlatformSettingsRecord | null = null;

  async getUserWorkspace(userId: string): Promise<UserWorkspaceState | null> {
    const found = this.workspaces.get(userId);
    return found ? structuredClone(found) : null;
  }
  async saveUserWorkspace(state: UserWorkspaceState): Promise<void> {
    this.workspaces.set(state.userId, structuredClone(state));
  }
  async listNotifications(page: PageRequest): Promise<Page<NotificationRecord>> {
    return paginate([...this.notifications.values()].sort(byNewest), page);
  }
  async putNotification(item: NotificationRecord): Promise<void> {
    this.notifications.set(item.id, structuredClone(item));
  }
  async getPlatformSettings(): Promise<PlatformSettingsRecord | null> {
    return this.platformSettings ? structuredClone(this.platformSettings) : null;
  }
  async savePlatformSettings(settings: PlatformSettingsRecord): Promise<void> {
    this.platformSettings = structuredClone(settings);
  }
}