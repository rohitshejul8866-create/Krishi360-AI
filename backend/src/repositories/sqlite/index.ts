import type { DatabaseSync } from 'node:sqlite';
import type { Role } from '../../middleware/auth';
import type { AuditEntry } from '../../models/audit';
import type { CaseStatus, CropCase } from '../../models/cropCase';
import type { Farm, SoilReading } from '../../models/farm';
import type { MandiPrice } from '../../models/mandi';
import type { Scheme } from '../../models/scheme';
import type { Inspection, StorageAlert, StorageBatch, StorageReading } from '../../models/storage';
import {
  mergeUserAccount,
  splitUserAccount,
  type UserAccount,
  type UserLoginRecord,
  type UserProfileRecord,
} from '../../models/user';
import type { NotificationRecord, PlatformSettingsRecord, UserWorkspaceState } from '../../models/workspace';
import { dateKey } from '../../utils/ids';
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
import {
  getSqliteItem,
  putSqliteItem,
  resolveSqliteTable,
  updateSqliteItem,
  type SqliteKeyAttrs,
  type SqliteTableName,
} from './client';

function paginateList<T>(items: T[], page: PageRequest): Page<T> {
  const cursor = decodeCursor<{ offset: number }>(page.cursor);
  const offset = cursor?.offset ?? 0;
  const sliced = items.slice(offset, offset + page.limit);
  const next = offset + page.limit;
  return {
    items: sliced,
    nextToken: next < items.length ? encodeCursor({ offset: next }) : null,
  };
}

function queryRows<T>(
  db: DatabaseSync,
  sql: string,
  params: Array<string | number | null>,
): T[] {
  const stmt = db.prepare(sql);
  const rows = stmt.all(...params) as Array<{ data: string }>;
  return rows.map((r) => JSON.parse(r.data) as T);
}

function selectEntityRows<T>(
  db: DatabaseSync,
  table: SqliteTableName,
  whereClause: string,
  params: Array<string | number | null>,
  orderBy = 'created_at DESC',
): T[] {
  const target = resolveSqliteTable(table);
  return queryRows<T>(db, `SELECT data FROM ${target} WHERE ${whereClause} ORDER BY ${orderBy}`, params);
}

function caseKeys(c: CropCase): SqliteKeyAttrs {
  return {
    pk: `CASE#${c.id}`,
    sk: 'META',
    entityType: 'cropCase',
    gsi1pk: `FARMER#${c.farmerId}`,
    gsi1sk: `${c.createdAt}#${c.id}`,
    gsi2pk: 'EXPERTQUEUE',
    gsi2sk: `${c.assignedExpertId ?? 'UNASSIGNED'}#${c.createdAt}#${c.id}`,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

export class SqliteCropCaseRepository implements CropCaseRepository {
  constructor(private db: DatabaseSync) {}

  async create(item: CropCase): Promise<void> {
    putSqliteItem(this.db, caseKeys(item), item, item.version);
  }

  async get(id: string): Promise<CropCase | null> {
    return getSqliteItem<CropCase>(this.db, `CASE#${id}`);
  }

  async update(item: CropCase, expectedVersion: number): Promise<void> {
    updateSqliteItem(this.db, caseKeys(item), item, expectedVersion);
  }

  async listByFarmer(farmerId: string, page: PageRequest, status?: CaseStatus): Promise<Page<CropCase>> {
    const rows = queryRows<CropCase>(
      this.db,
      'SELECT data FROM krishi_flag_items WHERE entity_type = ? AND gsi1pk = ? ORDER BY gsi1sk DESC',
      ['cropCase', `FARMER#${farmerId}`],
    ).filter((c) => !status || c.status === status);
    return paginateList(rows, page);
  }

  async listForExpert(expertId: string, page: PageRequest, status?: CaseStatus): Promise<Page<CropCase>> {
    const queueStatuses = new Set(['new', 'ai_review', 'expert_review']);
    const rows = queryRows<CropCase>(
      this.db,
      'SELECT data FROM krishi_flag_items WHERE entity_type = ? AND gsi2pk = ? ORDER BY created_at DESC',
      ['cropCase', 'EXPERTQUEUE'],
    ).filter(
      (c) =>
        (c.assignedExpertId === expertId || (c.assignedExpertId === undefined && queueStatuses.has(c.status))) &&
        (!status || c.status === status),
    );
    return paginateList(rows, page);
  }

  async listAll(page: PageRequest, status?: CaseStatus): Promise<Page<CropCase>> {
    const rows = queryRows<CropCase>(
      this.db,
      'SELECT data FROM krishi_flag_items WHERE entity_type = ? ORDER BY created_at DESC',
      ['cropCase'],
    ).filter((c) => !status || c.status === status);
    return paginateList(rows, page);
  }
}

function mandiKeys(p: MandiPrice): SqliteKeyAttrs {
  return {
    pk: `PRICE#${p.id}`,
    sk: 'META',
    entityType: 'mandiPrice',
    gsi1pk: `CROP#${p.crop}`,
    gsi1sk: `${p.date}#${p.state}#${p.mandi}#${p.id}`,
    gsi2pk: `STATE#${p.state}`,
    gsi2sk: `${p.date}#${p.crop}#${p.id}`,
    createdAt: p.createdAt,
    updatedAt: p.lastUpdatedAt,
  };
}

export class SqliteMandiRepository implements MandiRepository {
  constructor(private db: DatabaseSync) {}

  async put(item: MandiPrice): Promise<void> {
    putSqliteItem(this.db, mandiKeys(item), item, item.version);
  }

  async get(id: string): Promise<MandiPrice | null> {
    return getSqliteItem<MandiPrice>(this.db, `PRICE#${id}`);
  }

  async query(filters: MandiFilters, page: PageRequest): Promise<Page<MandiPrice>> {
    let rows: MandiPrice[];
    if (filters.crop) {
      rows = queryRows<MandiPrice>(
        this.db,
        'SELECT data FROM krishi_flag_items WHERE entity_type = ? AND gsi1pk = ? ORDER BY gsi1sk DESC',
        ['mandiPrice', `CROP#${filters.crop}`],
      );
    } else if (filters.state) {
      rows = queryRows<MandiPrice>(
        this.db,
        'SELECT data FROM krishi_flag_items WHERE entity_type = ? AND gsi2pk = ? ORDER BY gsi2sk DESC',
        ['mandiPrice', `STATE#${filters.state}`],
      );
    } else {
      rows = queryRows<MandiPrice>(
        this.db,
        'SELECT data FROM krishi_flag_items WHERE entity_type = ? ORDER BY created_at DESC',
        ['mandiPrice'],
      );
    }

    const filtered = rows
      .filter((p) => {
        if (filters.crop && p.crop !== filters.crop) return false;
        if (filters.state && p.state !== filters.state) return false;
        if (filters.district && p.district !== filters.district) return false;
        if (filters.mandi && p.mandi !== filters.mandi) return false;
        if (filters.date && p.date !== filters.date) return false;
        if (filters.dateFrom && p.date < filters.dateFrom) return false;
        if (filters.dateTo && p.date > filters.dateTo) return false;
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));

    return paginateList(filtered, page);
  }
}

function farmKeys(f: Farm): SqliteKeyAttrs {
  return {
    pk: `FARM#${f.id}`,
    sk: 'META',
    entityType: 'farm',
    gsi1pk: `FARMER#${f.farmerId}`,
    gsi1sk: `${f.createdAt}#${f.id}`,
    createdAt: f.createdAt,
    updatedAt: f.updatedAt,
  };
}

export class SqliteFarmRepository implements FarmRepository {
  constructor(private db: DatabaseSync) {}

  async create(item: Farm): Promise<void> {
    putSqliteItem(this.db, farmKeys(item), item, item.version);
  }

  async get(id: string): Promise<Farm | null> {
    return getSqliteItem<Farm>(this.db, `FARM#${id}`);
  }

  async update(item: Farm, expectedVersion: number): Promise<void> {
    updateSqliteItem(this.db, farmKeys(item), item, expectedVersion);
  }

  async listByOwner(ownerId: string, page: PageRequest): Promise<Page<Farm>> {
    const rows = queryRows<Farm>(
      this.db,
      'SELECT data FROM krishi_flag_items WHERE entity_type = ? AND gsi1pk = ? ORDER BY gsi1sk DESC',
      ['farm', `FARMER#${ownerId}`],
    );
    return paginateList(rows, page);
  }

  async listAll(page: PageRequest): Promise<Page<Farm>> {
    const rows = queryRows<Farm>(
      this.db,
      'SELECT data FROM krishi_flag_items WHERE entity_type = ? ORDER BY created_at DESC',
      ['farm'],
    );
    return paginateList(rows, page);
  }

  async addReading(reading: SoilReading): Promise<void> {
    putSqliteItem(
      this.db,
      {
        pk: `FARM#${reading.farmId}`,
        sk: `READING#${reading.createdAt}#${reading.id}`,
        entityType: 'soilReading',
        createdAt: reading.createdAt,
        updatedAt: reading.createdAt,
      },
      reading,
      1,
    );
  }

  async listReadings(farmId: string, plotId: string | undefined, page: PageRequest): Promise<Page<SoilReading>> {
    const rows = queryRows<SoilReading>(
      this.db,
      'SELECT data FROM krishi_flag_items WHERE pk = ? AND sk LIKE ? ORDER BY sk DESC',
      [`FARM#${farmId}`, 'READING#%'],
    ).filter((r) => !plotId || r.plotId === plotId);
    return paginateList(rows, page);
  }
}

function batchKeys(b: StorageBatch): SqliteKeyAttrs {
  return {
    pk: `BATCH#${b.id}`,
    sk: 'META',
    entityType: 'storageBatch',
    gsi1pk: `FARMER#${b.ownerId}`,
    gsi1sk: `${b.createdAt}#${b.id}`,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
  };
}

export class SqliteStorageRepository implements StorageRepository {
  constructor(private db: DatabaseSync) {}

  async createBatch(item: StorageBatch): Promise<void> {
    putSqliteItem(this.db, batchKeys(item), item, item.version);
  }

  async getBatch(id: string): Promise<StorageBatch | null> {
    return getSqliteItem<StorageBatch>(this.db, `BATCH#${id}`);
  }

  async updateBatch(item: StorageBatch, expectedVersion: number): Promise<void> {
    updateSqliteItem(this.db, batchKeys(item), item, expectedVersion);
  }

  async listByOwner(ownerId: string, page: PageRequest): Promise<Page<StorageBatch>> {
    const rows = queryRows<StorageBatch>(
      this.db,
      'SELECT data FROM krishi_flag_items WHERE entity_type = ? AND gsi1pk = ? ORDER BY gsi1sk DESC',
      ['storageBatch', `FARMER#${ownerId}`],
    );
    return paginateList(rows, page);
  }

  async listAll(page: PageRequest): Promise<Page<StorageBatch>> {
    const rows = queryRows<StorageBatch>(
      this.db,
      'SELECT data FROM krishi_flag_items WHERE entity_type = ? ORDER BY created_at DESC',
      ['storageBatch'],
    );
    return paginateList(rows, page);
  }

  async addReading(r: StorageReading): Promise<void> {
    putSqliteItem(
      this.db,
      {
        pk: `BATCH#${r.batchId}`,
        sk: `READING#${r.createdAt}#${r.id}`,
        entityType: 'storageReading',
        createdAt: r.createdAt,
        updatedAt: r.createdAt,
      },
      r,
      1,
    );
  }

  async listReadings(batchId: string, page: PageRequest): Promise<Page<StorageReading>> {
    const rows = queryRows<StorageReading>(
      this.db,
      'SELECT data FROM krishi_flag_items WHERE pk = ? AND sk LIKE ? ORDER BY sk DESC',
      [`BATCH#${batchId}`, 'READING#%'],
    );
    return paginateList(rows, page);
  }

  async addAlert(a: StorageAlert): Promise<void> {
    putSqliteItem(
      this.db,
      {
        pk: `BATCH#${a.batchId}`,
        sk: `ALERT#${a.createdAt}#${a.id}`,
        entityType: 'storageAlert',
        createdAt: a.createdAt,
        updatedAt: a.createdAt,
      },
      a,
      1,
    );
  }

  async listAlerts(batchId: string, page: PageRequest): Promise<Page<StorageAlert>> {
    const rows = queryRows<StorageAlert>(
      this.db,
      'SELECT data FROM krishi_flag_items WHERE pk = ? AND sk LIKE ? ORDER BY sk DESC',
      [`BATCH#${batchId}`, 'ALERT#%'],
    );
    return paginateList(rows, page);
  }

  async addInspection(i: Inspection): Promise<void> {
    putSqliteItem(
      this.db,
      {
        pk: `BATCH#${i.batchId}`,
        sk: `INSPECTION#${i.createdAt}#${i.id}`,
        entityType: 'storageInspection',
        createdAt: i.createdAt,
        updatedAt: i.createdAt,
      },
      i,
      1,
    );
  }

  async listInspections(batchId: string): Promise<Inspection[]> {
    return queryRows<Inspection>(
      this.db,
      'SELECT data FROM krishi_flag_items WHERE pk = ? AND sk LIKE ? ORDER BY sk DESC',
      [`BATCH#${batchId}`, 'INSPECTION#%'],
    );
  }
}

function schemeKeys(s: Scheme): SqliteKeyAttrs {
  return {
    pk: `SCHEME#${s.id}`,
    sk: 'META',
    entityType: 'scheme',
    gsi1pk: `CATEGORY#${s.category}`,
    gsi1sk: `${s.state}#${s.name}#${s.id}`,
    searchText: [s.name, s.summary, s.category, ...s.tags].join(' ').toLowerCase(),
    createdAt: s.createdAt,
    updatedAt: s.lastUpdatedAt,
  };
}

export class SqliteSchemeRepository implements SchemeRepository {
  constructor(private db: DatabaseSync) {}

  async put(item: Scheme): Promise<void> {
    putSqliteItem(this.db, schemeKeys(item), item, item.version);
  }

  async get(id: string): Promise<Scheme | null> {
    return getSqliteItem<Scheme>(this.db, `SCHEME#${id}`);
  }

  async list(filters: SchemeFilters, page: PageRequest): Promise<Page<Scheme>> {
    const rows = filters.category
      ? queryRows<Scheme>(
          this.db,
          'SELECT data FROM krishi_flag_items WHERE entity_type = ? AND gsi1pk = ? ORDER BY gsi1sk ASC',
          ['scheme', `CATEGORY#${filters.category}`],
        )
      : queryRows<Scheme>(
          this.db,
          'SELECT data FROM krishi_flag_items WHERE entity_type = ? ORDER BY gsi1sk ASC',
          ['scheme'],
        );

    const q = filters.q?.toLowerCase();
    const filtered = rows
      .filter((s) => {
        if (filters.state && s.state !== filters.state && s.state !== 'All India') return false;
        if (q && ![s.name, s.summary, s.category, ...s.tags].some((v) => v.toLowerCase().includes(q))) {
          return false;
        }
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    return paginateList(filtered, page);
  }
}

export class SqliteAuditRepository implements AuditRepository {
  constructor(private db: DatabaseSync) {}

  async put(entry: AuditEntry): Promise<void> {
    putSqliteItem(
      this.db,
      {
        pk: `AUDIT#${dateKey(entry.timestamp)}`,
        sk: `${entry.timestamp}#${entry.id}`,
        entityType: 'auditEntry',
        gsi1pk: `ACTOR#${entry.actorId}`,
        gsi1sk: entry.timestamp,
        createdAt: entry.timestamp,
        updatedAt: entry.timestamp,
      },
      entry,
      1,
    );
  }

  async list(page: PageRequest, actorId?: string): Promise<Page<AuditEntry>> {
    const rows = actorId
      ? queryRows<AuditEntry>(
          this.db,
          'SELECT data FROM krishi_flag_items WHERE entity_type = ? AND gsi1pk = ? ORDER BY created_at DESC',
          ['auditEntry', `ACTOR#${actorId}`],
        )
      : queryRows<AuditEntry>(
          this.db,
          'SELECT data FROM krishi_flag_items WHERE entity_type = ? ORDER BY created_at DESC',
          ['auditEntry'],
        );
    return paginateList(rows, page);
  }
}

function userLoginKeys(u: UserLoginRecord): SqliteKeyAttrs {
  return {
    pk: `USER#${u.id}`,
    sk: 'LOGIN',
    entityType: 'userLogin',
    gsi1pk: `EMAIL#${u.email.toLowerCase()}`,
    gsi1sk: `USER#${u.id}`,
    gsi2pk: `ROLE#${u.role}`,
    gsi2sk: `${u.createdAt}#${u.id}`,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  };
}

function userProfileKeys(p: UserProfileRecord): SqliteKeyAttrs {
  return {
    pk: `USER_PROFILE#${p.id}`,
    sk: 'META',
    entityType: 'userProfile',
    gsi1pk: `PROFILE#${p.id}`,
    gsi1sk: p.updatedAt,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

export class SqliteUserRepository implements UserRepository {
  constructor(private db: DatabaseSync) {}

  async create(item: UserAccount): Promise<void> {
    const { login, profile } = splitUserAccount(item);
    putSqliteItem(this.db, userLoginKeys(login), login, login.version, 'krishi_users');
    putSqliteItem(this.db, userProfileKeys(profile), profile, profile.version, 'krishi_flag_items');
  }

  async get(id: string): Promise<UserAccount | null> {
    const login = getSqliteItem<UserLoginRecord>(this.db, `USER#${id}`, 'LOGIN', 'krishi_users');
    if (!login) return null;
    const profile = getSqliteItem<UserProfileRecord>(
      this.db,
      `USER_PROFILE#${id}`,
      'META',
      'krishi_flag_items',
    );
    return mergeUserAccount(login, profile);
  }

  async getByEmail(email: string): Promise<UserAccount | null> {
    const rows = selectEntityRows<UserLoginRecord>(
      this.db,
      'krishi_users',
      'entity_type = ? AND gsi1pk = ?',
      ['userLogin', `EMAIL#${email.trim().toLowerCase()}`],
      'created_at DESC',
    );
    const login = rows[0];
    if (!login) return null;
    const profile = getSqliteItem<UserProfileRecord>(
      this.db,
      `USER_PROFILE#${login.id}`,
      'META',
      'krishi_flag_items',
    );
    return mergeUserAccount(login, profile);
  }

  async update(item: UserAccount, expectedVersion: number): Promise<void> {
    const { login, profile } = splitUserAccount(item);
    updateSqliteItem(this.db, userLoginKeys(login), login, expectedVersion, 'krishi_users');
    putSqliteItem(this.db, userProfileKeys(profile), profile, profile.version, 'krishi_flag_items');
  }

  async list(page: PageRequest, role?: Role): Promise<Page<UserAccount>> {
    const logins = role
      ? selectEntityRows<UserLoginRecord>(
          this.db,
          'krishi_users',
          'entity_type = ? AND gsi2pk = ?',
          ['userLogin', `ROLE#${role}`],
        )
      : selectEntityRows<UserLoginRecord>(this.db, 'krishi_users', 'entity_type = ?', ['userLogin']);
    const accounts = logins.map((login) => {
      const profile = getSqliteItem<UserProfileRecord>(
        this.db,
        `USER_PROFILE#${login.id}`,
        'META',
        'krishi_flag_items',
      );
      return mergeUserAccount(login, profile);
    });
    return paginateList(accounts, page);
  }
}

export class SqliteWorkspaceRepository implements WorkspaceRepository {
  constructor(private db: DatabaseSync) {}

  async getUserWorkspace(userId: string): Promise<UserWorkspaceState | null> {
    return getSqliteItem<UserWorkspaceState>(this.db, `WORKSPACE#${userId}`);
  }

  async saveUserWorkspace(state: UserWorkspaceState): Promise<void> {
    putSqliteItem(
      this.db,
      {
        pk: `WORKSPACE#${state.userId}`,
        sk: 'META',
        entityType: 'userWorkspace',
        gsi1pk: `WORKSPACE_USER#${state.userId}`,
        gsi1sk: state.updatedAt,
        createdAt: state.updatedAt,
        updatedAt: state.updatedAt,
      },
      state,
      state.version,
    );
  }

  async listNotifications(page: PageRequest): Promise<Page<NotificationRecord>> {
    const rows = queryRows<NotificationRecord>(
      this.db,
      'SELECT data FROM krishi_flag_items WHERE entity_type = ? ORDER BY created_at DESC',
      ['notification'],
    );
    return paginateList(rows, page);
  }

  async putNotification(item: NotificationRecord): Promise<void> {
    putSqliteItem(
      this.db,
      {
        pk: `NOTIF#${item.id}`,
        sk: 'META',
        entityType: 'notification',
        gsi1pk: `NOTIF_AUDIENCE#${item.audience}`,
        gsi1sk: `${item.createdAt}#${item.id}`,
        createdAt: item.createdAt,
        updatedAt: item.createdAt,
      },
      item,
      1,
    );
  }

  async getPlatformSettings(): Promise<PlatformSettingsRecord | null> {
    return getSqliteItem<PlatformSettingsRecord>(this.db, 'SETTINGS#global');
  }

  async savePlatformSettings(settings: PlatformSettingsRecord): Promise<void> {
    putSqliteItem(
      this.db,
      {
        pk: 'SETTINGS#global',
        sk: 'META',
        entityType: 'platformSettings',
        createdAt: settings.updatedAt,
        updatedAt: settings.updatedAt,
      },
      settings,
      settings.version,
    );
  }
}
