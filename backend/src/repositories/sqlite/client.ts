import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { AppConfig } from '../../config/env';
import { ConflictError } from '../../utils/errors';

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
  totalItems: number;
  indexCount: number;
  message: string;
}

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS krishi_items (
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

CREATE INDEX IF NOT EXISTS idx_krishi_entity ON krishi_items (entity_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_krishi_gsi1 ON krishi_items (gsi1pk, gsi1sk);
CREATE INDEX IF NOT EXISTS idx_krishi_gsi2 ON krishi_items (gsi2pk, gsi2sk);
CREATE INDEX IF NOT EXISTS idx_krishi_pk_sk ON krishi_items (pk, sk);
`;

const instances = new Map<string, DatabaseSync>();

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
): void {
  const now = new Date().toISOString();
  const createdAt = keys.createdAt ?? (data as { createdAt?: string; timestamp?: string }).createdAt ?? (data as { timestamp?: string }).timestamp ?? now;
  const updatedAt = keys.updatedAt ?? (data as { updatedAt?: string; lastUpdatedAt?: string }).updatedAt ?? (data as { lastUpdatedAt?: string }).lastUpdatedAt ?? createdAt;

  const stmt = db.prepare(`
    INSERT INTO krishi_items (
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
): boolean {
  const now = new Date().toISOString();
  const createdAt = keys.createdAt ?? (data as { createdAt?: string; timestamp?: string }).createdAt ?? (data as { timestamp?: string }).timestamp ?? now;
  const updatedAt = keys.updatedAt ?? (data as { updatedAt?: string; lastUpdatedAt?: string }).updatedAt ?? (data as { lastUpdatedAt?: string }).lastUpdatedAt ?? createdAt;

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO krishi_items (
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

export function getSqliteItem<T>(db: DatabaseSync, pk: string, sk = 'META'): T | null {
  const stmt = db.prepare('SELECT data FROM krishi_items WHERE pk = ? AND sk = ? LIMIT 1');
  const row = stmt.get(pk, sk) as { data: string } | undefined;
  return row ? (JSON.parse(row.data) as T) : null;
}

export function updateSqliteItem<T extends { version: number }>(
  db: DatabaseSync,
  keys: SqliteKeyAttrs,
  data: T,
  expectedVersion: number,
): void {
  const now = new Date().toISOString();
  const updatedAt = keys.updatedAt ?? (data as { updatedAt?: string }).updatedAt ?? now;
  const stmt = db.prepare(`
    UPDATE krishi_items
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

export function countSqliteEntities(db: DatabaseSync): Record<string, number> {
  const rows = db.prepare('SELECT entity_type, COUNT(*) AS total FROM krishi_items GROUP BY entity_type').all() as Array<{
    entity_type: string;
    total: number;
  }>;
  const counts: Record<string, number> = {};
  for (const row of rows) {
    counts[row.entity_type] = Number(row.total);
  }
  return counts;
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
  const countRow = db.prepare('SELECT COUNT(*) AS total FROM krishi_items').get() as { total: number } | undefined;
  const idxRow = db
    .prepare("SELECT COUNT(*) AS total FROM sqlite_master WHERE type = 'index' AND tbl_name = 'krishi_items'")
    .get() as { total: number } | undefined;

  let integrityOk = true;
  if (runIntegrity) {
    const check = db.prepare('PRAGMA integrity_check;').get() as { integrity_check?: string } | undefined;
    integrityOk = check?.integrity_check === 'ok';
  }

  const journalMode = (journalRow?.journal_mode ?? 'wal').toUpperCase();
  const totalItems = Number(countRow?.total ?? 0);
  const indexCount = Number(idxRow?.total ?? 0);

  return {
    dbPath: config.sqliteDbPath,
    exists,
    journalMode,
    integrityOk,
    fileSizeBytes,
    totalItems,
    indexCount,
    message: `Persistent SQLite single-table active (${journalMode} mode, ${totalItems} indexed items, ${(fileSizeBytes / 1024).toFixed(1)} KB).`,
  };
}
