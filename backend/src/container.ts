/**
 * Dependency wiring. Handlers resolve services through this container.
 * Supports persistent SQLite single-table storage (default locally),
 * AWS DynamoDB single-table storage (production / configured AWS),
 * and fast in-memory storage (unit tests).
 */

import { loadConfig, type AppConfig } from './config/env';
import { DynamoAuditRepository } from './repositories/dynamo/auditRepo';
import { getDocClient } from './repositories/dynamo/client';
import { DynamoCropCaseRepository } from './repositories/dynamo/cropCaseRepo';
import { DynamoFarmRepository } from './repositories/dynamo/farmRepo';
import { DynamoMandiRepository } from './repositories/dynamo/mandiRepo';
import { DynamoSchemeRepository } from './repositories/dynamo/schemeRepo';
import { DynamoStorageRepository } from './repositories/dynamo/storageRepo';
import { DynamoUserRepository } from './repositories/dynamo/userRepo';
import { DynamoWorkspaceRepository } from './repositories/dynamo/workspaceRepo';
import {
  MemoryAuditRepository,
  MemoryCropCaseRepository,
  MemoryFarmRepository,
  MemoryMandiRepository,
  MemorySchemeRepository,
  MemoryStorageRepository,
  MemoryUserRepository,
  MemoryWorkspaceRepository,
} from './repositories/memory';
import { getSqliteDb } from './repositories/sqlite/client';
import {
  SqliteAuditRepository,
  SqliteCropCaseRepository,
  SqliteFarmRepository,
  SqliteMandiRepository,
  SqliteSchemeRepository,
  SqliteStorageRepository,
  SqliteUserRepository,
  SqliteWorkspaceRepository,
} from './repositories/sqlite';
import type {
  AuditRepository,
  CropCaseRepository,
  FarmRepository,
  MandiRepository,
  SchemeRepository,
  StorageRepository,
  UserRepository,
  WorkspaceRepository,
} from './repositories/types';
import { createAiService } from './services/ai/factory';
import { AuditService } from './services/auditService';
import { AuthService } from './services/authService';
import { CropDoctorService } from './services/cropDoctorService';
import { GrainGuardService } from './services/grainGuardService';
import { JalSenseService } from './services/jalSenseService';
import { MandiService } from './services/mandiService';
import { SchemeService } from './services/schemeService';
import { UploadService } from './services/uploadService';
import { WorkspaceService } from './services/workspaceService';

export interface Repositories {
  cases: CropCaseRepository;
  mandi: MandiRepository;
  farms: FarmRepository;
  storage: StorageRepository;
  schemes: SchemeRepository;
  audit: AuditRepository;
  users: UserRepository;
  workspace: WorkspaceRepository;
}

export interface Container {
  config: AppConfig;
  repos: Repositories;
  audit: AuditService;
  auth: AuthService;
  cropDoctor: CropDoctorService;
  mandi: MandiService;
  jalSense: JalSenseService;
  grainGuard: GrainGuardService;
  schemes: SchemeService;
  workspace: WorkspaceService;
}

export function buildRepositories(config: AppConfig): Repositories {
  if (config.dataBackend === 'memory') {
    return {
      cases: new MemoryCropCaseRepository(),
      mandi: new MemoryMandiRepository(),
      farms: new MemoryFarmRepository(),
      storage: new MemoryStorageRepository(),
      schemes: new MemorySchemeRepository(),
      audit: new MemoryAuditRepository(),
      users: new MemoryUserRepository(),
      workspace: new MemoryWorkspaceRepository(),
    };
  }
  if (config.dataBackend === 'sqlite') {
    const db = getSqliteDb(config.sqliteDbPath);
    return {
      cases: new SqliteCropCaseRepository(db),
      mandi: new SqliteMandiRepository(db),
      farms: new SqliteFarmRepository(db),
      storage: new SqliteStorageRepository(db),
      schemes: new SqliteSchemeRepository(db),
      audit: new SqliteAuditRepository(db),
      users: new SqliteUserRepository(db),
      workspace: new SqliteWorkspaceRepository(db),
    };
  }
  const client = getDocClient(config);
  const table = config.tableName;
  return {
    cases: new DynamoCropCaseRepository(client, table),
    mandi: new DynamoMandiRepository(client, table),
    farms: new DynamoFarmRepository(client, table),
    storage: new DynamoStorageRepository(client, table),
    schemes: new DynamoSchemeRepository(client, table),
    audit: new DynamoAuditRepository(client, table),
    users: new DynamoUserRepository(client, table),
    workspace: new DynamoWorkspaceRepository(client, table),
  };
}

export function buildContainer(config: AppConfig, repos: Repositories = buildRepositories(config)): Container {
  const audit = new AuditService(repos.audit);
  const auth = new AuthService(repos.users, audit);
  const uploads = new UploadService(config);
  const ai = createAiService(config);
  return {
    config,
    repos,
    audit,
    auth,
    cropDoctor: new CropDoctorService(repos.cases, ai, uploads, audit),
    mandi: new MandiService(repos.mandi, audit),
    jalSense: new JalSenseService(repos.farms, audit),
    grainGuard: new GrainGuardService(repos.storage, audit),
    schemes: new SchemeService(repos.schemes, audit),
    workspace: new WorkspaceService(repos.workspace, audit),
  };
}

let current: Container | undefined;

export function getContainer(): Container {
  if (!current) current = buildContainer(loadConfig());
  return current;
}

/** Test / local-server seam. */
export function setContainer(container: Container | undefined): void {
  current = container;
}