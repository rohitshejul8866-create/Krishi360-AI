import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { AppConfig } from '../../config/env';
import { splitUserAccount, type UserAccount } from '../../models/user';
import { ConflictError } from '../../utils/errors';

export type SqliteTableName = 'krishi_users' | 'krishi_flag_items';

export interface SqliteKeyAttrs {
  pk: string;
  sk: string;
  entityType: string;
  gsi1pk?: string;
  gsi1sk?: string;
  gsi2pk?: string;
  gsi2sk?: string;
  searchText?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SqliteInspection {
  dbPath: string;
  exists: boolean;
  journalMode: string;
  integrityOk: boolean;
  fileSizeBytes: number;
  usersItems: number;
  flagItems: number;
  totalItems: number;
  indexCount: number;
  tables: SqliteTableName[];
  message: string;
}

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS krishi_users (
  pk TEXT NOT NULL,
  sk TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  gsi1pk TEXT,
  gsi1sk TEXT,
  gsi2pk TEXT,
  gsi2sk TEXT,
  search_text TEXT,
  data TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (pk, sk)
);

CREATE INDEX IF NOT EXISTS idx_krishi_users_entity ON krishi_users (entity_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_krishi_users_gsi1 ON krishi_users (gsi1pk, gsi1sk);
CREATE INDEX IF NOT EXISTS idx_krishi_users_gsi2 ON krishi_users (gsi2pk, gsi2sk);
CREATE INDEX IF NOT EXISTS idx_krishi_users_pk_sk ON krishi_users (pk, sk);

CREATE TABLE IF NOT EXISTS krishi_flag_items (
  pk TEXT NOT NULL,
  sk TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  gsi1pk TEXT,
  gsi1sk TEXT,
  gsi2pk TEXT,
  gsi2sk TEXT,
  search_text TEXT,
  data TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (pk, sk)
);

CREATE INDEX IF NOT EXISTS idx_krishi_flag_entity ON krishi_flag_items (entity_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_krishi_flag_gsi1 ON krishi_flag_items (gsi1pk, gsi1sk);
CREATE INDEX IF NOT EXISTS idx_krishi_flag_gsi2 ON krishi_flag_items (gsi2pk, gsi2sk);
CREATE INDEX IF NOT EXISTS idx_krishi_flag_pk_sk ON krishi_flag_items (pk, sk);
`;

const ALLOWED_TABLES: ReadonlySet<SqliteTableName> = new Set(['krishi_users', 'krishi_flag_items']);

export function resolveSqliteTable(table: SqliteTableName = 'krishi_flag_items'): SqliteTableName {
  if (!ALLOWED_TABLES.has(table)) {
    throw new Error(`Invalid SQLite table: ${table}`);
  }
  return table;
}

const instances = new Map<string, DatabaseSync>();

function migrateLegacySingleTable(db: DatabaseSync): void {
  const legacyExists = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'krishi_items'")
    .get() as { name?: string } | undefined;
  if (!legacyExists?.name) return;

  const rows = db.prepare('SELECT * FROM krishi_items').all() as Array<{
    pk: string;
    sk: string;
    entity_type: string;
    gsi1pk: string | null;
    gsi1sk: string | null;
    gsi2pk: string | null;
    gsi2sk: string | null;
    search_text: string | null;
    data: string;
    version: number;
    created_at: string;
    updated_at: string;
  }>;

  for (const row of rows) {
    if (row.entity_type === 'userAccount') {
      const account = JSON.parse(row.data) as UserAccount;
      const { login, profile } = splitUserAccount(account);
      putSqliteItemIfAbsent(
        db,
        {
          pk: `USER#${login.id}`,
          sk: 'LOGIN',
          entityType: 'userLogin',
          gsi1pk: `EMAIL#${login.email.toLowerCase()}`,
          gsi1sk: `USER#${login.id}`,
          gsi2pk: `ROLE#${login.role}`,
          gsi2sk: `${login.createdAt}#${login.id}`,
          createdAt: login.createdAt,
          updatedAt: login.updatedAt,
        },
        login,
        login.version,
        'krishi_users',
      );
      putSqliteItemIfAbsent(
        db,
        {
          pk: `USER_PROFILE#${profile.id}`,
          sk: 'META',
          entityType: 'userProfile',
          gsi1pk: `PROFILE#${profile.id}`,
          gsi1sk: profile.updatedAt,
          createdAt: profile.createdAt,
          updatedAt: profile.updatedAt,
        },
        profile,
        profile.version,
        'krishi_flag_items',
      );
    } else {
      putSqliteItemIfAbsent(
        db,
        {
          pk: row.pk,
          sk: row.sk,
          entityType: row.entity_type,
          gsi1pk: row.gsi1pk ?? undefined,
          gsi1sk: row.gsi1sk ?? undefined,
          gsi2pk: row.gsi2pk ?? undefined,
          gsi2sk: row.gsi2sk ?? undefined,
          searchText: row.search_text ?? undefined,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        },
        JSON.parse(row.data) as object,
        row.version,
        'krishi_flag_items',
      );
    }
  }

  db.exec('DROP TABLE IF EXISTS krishi_items;');
}

export function getSqliteDb(dbPath: string): DatabaseSync {
  const resolved = path.resolve(dbPath);
  let db = instances.get(resolved);
  if (!db) {
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    db = new DatabaseSync(resolved);
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA synchronous = NORMAL;');
    db.exec('PRAGMA foreign_keys = ON;');
    db.exec('PRAGMA busy_timeout = 5000;');
    db.exec('PRAGMA temp_store = MEMORY;');
    db.exec(SCHEMA_SQL);
    migrateLegacySingleTable(db);
    instances.set(resolved, db);
  }
  return db;
}

export function closeSqliteDbs(): void {
  for (const db of instances.values()) {
    try {
      db.close();
    } catch {
      // ignore close errors during shutdown
    }
  }
  instances.clear();
}

export function putSqliteItem<T extends object>(
  db: DatabaseSync,
  keys: SqliteKeyAttrs,
  data: T,
  version = 1,
  table: SqliteTableName = 'krishi_flag_items',
): void {
  const target = resolveSqliteTable(table);
  const now = new Date().toISOString();
  const createdAt =
    keys.createdAt ??
    (data as { createdAt?: string; timestamp?: string }).createdAt ??
    (data as { timestamp?: string }).timestamp ??
    now;
  const updatedAt =
    keys.updatedAt ??
    (data as { updatedAt?: string; lastUpdatedAt?: string }).updatedAt ??
    (data as { lastUpdatedAt?: string }).lastUpdatedAt ??
    createdAt;

  const stmt = db.prepare(`
    INSERT INTO ${target} (
      pk, sk, entity_type, gsi1pk, gsi1sk, gsi2pk, gsi2sk, search_text, data, version, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(pk, sk) DO UPDATE SET
      entity_type = excluded.entity_type,
      gsi1pk = excluded.gsi1pk,
      gsi1sk = excluded.gsi1sk,
      gsi2pk = excluded.gsi2pk,
      gsi2sk = excluded.gsi2sk,
      search_text = excluded.search_text,
      data = excluded.data,
      version = excluded.version,
      updated_at = excluded.updated_at
  `);
  stmt.run(
    keys.pk,
    keys.sk,
    keys.entityType,
    keys.gsi1pk ?? null,
    keys.gsi1sk ?? null,
    keys.gsi2pk ?? null,
    keys.gsi2sk ?? null,
    keys.searchText ?? null,
    JSON.stringify(data),
    version,
    createdAt,
    updatedAt,
  );
}

export function putSqliteItemIfAbsent<T extends object>(
  db: DatabaseSync,
  keys: SqliteKeyAttrs,
  data: T,
  version = 1,
  table: SqliteTableName = 'krishi_flag_items',
): boolean {
  const target = resolveSqliteTable(table);
  const now = new Date().toISOString();
  const createdAt =
    keys.createdAt ??
    (data as { createdAt?: string; timestamp?: string }).createdAt ??
    (data as { timestamp?: string }).timestamp ??
    now;
  const updatedAt =
    keys.updatedAt ??
    (data as { updatedAt?: string; lastUpdatedAt?: string }).updatedAt ??
    (data as { lastUpdatedAt?: string }).lastUpdatedAt ??
    createdAt;

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO ${target} (
      pk, sk, entity_type, gsi1pk, gsi1sk, gsi2pk, gsi2sk, search_text, data, version, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    keys.pk,
    keys.sk,
    keys.entityType,
    keys.gsi1pk ?? null,
    keys.gsi1sk ?? null,
    keys.gsi2pk ?? null,
    keys.gsi2sk ?? null,
    keys.searchText ?? null,
    JSON.stringify(data),
    version,
    createdAt,
    updatedAt,
  );
  return Number(result.changes) > 0;
}

export function getSqliteItem<T>(
  db: DatabaseSync,
  pk: string,
  sk = 'META',
  table: SqliteTableName = 'krishi_flag_items',
): T | null {
  const target = resolveSqliteTable(table);
  const stmt = db.prepare(`SELECT data FROM ${target} WHERE pk = ? AND sk = ? LIMIT 1`);
  const row = stmt.get(pk, sk) as { data: string } | undefined;
  return row ? (JSON.parse(row.data) as T) : null;
}

export function updateSqliteItem<T extends { version: number }>(
  db: DatabaseSync,
  keys: SqliteKeyAttrs,
  data: T,
  expectedVersion: number,
  table: SqliteTableName = 'krishi_flag_items',
): void {
  const target = resolveSqliteTable(table);
  const now = new Date().toISOString();
  const updatedAt = keys.updatedAt ?? (data as { updatedAt?: string }).updatedAt ?? now;
  const stmt = db.prepare(`
    UPDATE ${target}
    SET entity_type = ?,
        gsi1pk = ?,
        gsi1sk = ?,
        gsi2pk = ?,
        gsi2sk = ?,
        search_text = ?,
        data = ?,
        version = ?,
        updated_at = ?
    WHERE pk = ? AND sk = ? AND version = ?
  `);
  const result = stmt.run(
    keys.entityType,
    keys.gsi1pk ?? null,
    keys.gsi1sk ?? null,
    keys.gsi2pk ?? null,
    keys.gsi2sk ?? null,
    keys.searchText ?? null,
    JSON.stringify(data),
    data.version,
    updatedAt,
    keys.pk,
    keys.sk,
    expectedVersion,
  );
  if (Number(result.changes) === 0) {
    throw new ConflictError();
  }
}

export function inspectSqliteDatabase(config: AppConfig, runIntegrity = false): SqliteInspection {
  const db = getSqliteDb(config.sqliteDbPath);
  const exists = fs.existsSync(config.sqliteDbPath);
  let fileSizeBytes = exists ? fs.statSync(config.sqliteDbPath).size : 0;
  const walPath = `${config.sqliteDbPath}-wal`;
  if (fs.existsSync(walPath)) {
    fileSizeBytes += fs.statSync(walPath).size;
  }

  const journalRow = db.prepare('PRAGMA journal_mode;').get() as { journal_mode?: string } | undefined;
  const usersRow = db.prepare('SELECT COUNT(*) AS total FROM krishi_users').get() as { total: number } | undefined;
  const flagRow = db.prepare('SELECT COUNT(*) AS total FROM krishi_flag_items').get() as { total: number } | undefined;
  const idxRow = db
    .prepare("SELECT COUNT(*) AS total FROM sqlite_master WHERE type = 'index' AND tbl_name IN ('krishi_users', 'krishi_flag_items')")
    .get() as { total: number } | undefined;

  let integrityOk = true;
  if (runIntegrity) {
    const check = db.prepare('PRAGMA integrity_check;').get() as { integrity_check?: string } | undefined;
    integrityOk = check?.integrity_check === 'ok';
  }

  const journalMode = (journalRow?.journal_mode ?? 'wal').toUpperCase();
  const usersItems = Number(usersRow?.total ?? 0);
  const flagItems = Number(flagRow?.total ?? 0);
  const totalItems = usersItems + flagItems;
  const indexCount = Number(idxRow?.total ?? 0);

  return {
    dbPath: config.sqliteDbPath,
    exists,
    journalMode,
    integrityOk,
    fileSizeBytes,
    usersItems,
    flagItems,
    totalItems,
    indexCount,
    tables: ['krishi_users', 'krishi_flag_items'],
    message: `Persistent SQLite 2-table store active (${journalMode} mode, ${usersItems} user login items + ${flagItems} flag/domain items, ${(fileSizeBytes / 1024).toFixed(1)} KB).`,
  };
}
