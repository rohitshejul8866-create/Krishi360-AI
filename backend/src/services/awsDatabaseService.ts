import {
  CreateTableCommand,
  DescribeTableCommand,
  ResourceNotFoundException,
  waitUntilTableExists,
} from '@aws-sdk/client-dynamodb';
import type { AppConfig } from '../config/env';
import type { Container, Repositories } from '../container';
import type { AuthUser } from '../middleware/auth';
import { toPublicUser } from '../models/user';
import { getBaseDynamoClient } from '../repositories/dynamo/client';
import { inspectSqliteDatabase, type SqliteInspection } from '../repositories/sqlite/client';
import { seedDemoPortalData, type SeedOptions } from '../seed/demoPortalSeed';
import { ServiceUnavailableError, ValidationError } from '../utils/errors';
import type { Logger } from '../utils/logger';

export type TableState = 'ACTIVE' | 'CREATING' | 'UPDATING' | 'NOT_FOUND' | 'NOT_CONFIGURED' | 'UNREACHABLE';

export type BackendEntityName =
  | 'cropCases'
  | 'mandiPrices'
  | 'schemes'
  | 'storageBatches'
  | 'farms'
  | 'auditLogs'
  | 'users'
  | 'notifications';

export interface DynamoTableInspection {
  reachable: boolean;
  tableStatus: TableState;
  billingMode: string | null;
  approximateItemCount: number | null;
  gsiNames: string[];
  message: string;
}

export interface BackendEndpointInfo {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH';
  path: string;
  module: string;
  auth: 'Public' | 'Authenticated' | 'Expert / Admin' | 'Admin only';
  description: string;
}

export interface BackendStatusSnapshot {
  service: string;
  dataBackend: AppConfig['dataBackend'];
  awsRegion: string;
  usersTableName: string;
  flagTableName: string;
  tableName: string;
  customEndpointConfigured: boolean;
  awsCredentialsConfigured: boolean;
  s3UploadsConfigured: boolean;
  aiProvider: AppConfig['aiProvider'];
  authMode: AppConfig['authMode'];
  dynamo: DynamoTableInspection;
  usersDynamo: DynamoTableInspection;
  flagDynamo: DynamoTableInspection;
  sqlite?: SqliteInspection;
  counts: Record<BackendEntityName, number>;
  singleTableSchema: Array<{
    table: 'Users Login Table' | 'Flag Data Table';
    entity: string;
    pkPattern: string;
    skPattern: string;
    gsi1: string;
    gsi2: string;
  }>;
  endpoints: BackendEndpointInfo[];
  checkedAt: string;
  seedResult?: { inserted: number; skipped: number };
}

const SINGLE_TABLE_SCHEMA: BackendStatusSnapshot['singleTableSchema'] = [
  { table: 'Users Login Table', entity: 'UserLogin (Credentials)', pkPattern: 'USER#<id>', skPattern: 'LOGIN', gsi1: 'EMAIL#<email>', gsi2: 'ROLE#<role>' },
  { table: 'Flag Data Table', entity: 'UserProfile (Details)', pkPattern: 'USER_PROFILE#<id>', skPattern: 'META', gsi1: 'PROFILE#<id>', gsi2: '—' },
  { table: 'Flag Data Table', entity: 'UserWorkspace', pkPattern: 'WORKSPACE#<userId>', skPattern: 'META', gsi1: '—', gsi2: '—' },
  { table: 'Flag Data Table', entity: 'Notification', pkPattern: 'NOTIF#<id>', skPattern: 'META', gsi1: 'NOTIF_FEED', gsi2: '<createdAt>' },
  { table: 'Flag Data Table', entity: 'PlatformSettings (Flags)', pkPattern: 'SETTINGS#global', skPattern: 'META', gsi1: '—', gsi2: '—' },
  { table: 'Flag Data Table', entity: 'CropCase', pkPattern: 'CASE#<id>', skPattern: 'META', gsi1: 'FARMER#<farmerId>', gsi2: 'EXPERTQUEUE' },
  { table: 'Flag Data Table', entity: 'MandiPrice', pkPattern: 'PRICE#<id>', skPattern: 'META', gsi1: 'CROP#<crop>', gsi2: 'STATE#<state>' },
  { table: 'Flag Data Table', entity: 'Scheme', pkPattern: 'SCHEME#<id>', skPattern: 'META', gsi1: 'CATEGORY#<cat>', gsi2: '—' },
  { table: 'Flag Data Table', entity: 'Farm & Plots', pkPattern: 'FARM#<id>', skPattern: 'META', gsi1: 'FARMER#<farmerId>', gsi2: '—' },
  { table: 'Flag Data Table', entity: 'SoilReading', pkPattern: 'FARM#<farmId>', skPattern: 'READING#<ts>#<id>', gsi1: '—', gsi2: '—' },
  { table: 'Flag Data Table', entity: 'StorageBatch', pkPattern: 'BATCH#<id>', skPattern: 'META', gsi1: 'FARMER#<ownerId>', gsi2: '—' },
  { table: 'Flag Data Table', entity: 'StorageReading / Alert', pkPattern: 'BATCH#<batchId>', skPattern: 'READING# | ALERT# | INSPECTION#', gsi1: '—', gsi2: '—' },
  { table: 'Flag Data Table', entity: 'AuditEntry', pkPattern: 'AUDIT#<YYYY-MM-DD>', skPattern: '<ts>#<id>', gsi1: 'ACTOR#<actorId>', gsi2: '—' },
];

const API_ENDPOINTS: BackendEndpointInfo[] = [
  { method: 'GET', path: '/api/health', module: 'Platform', auth: 'Public', description: 'Service heartbeat & active backend mode' },
  { method: 'GET', path: '/api/me', module: 'Auth', auth: 'Authenticated', description: 'Active caller identity & role claims' },
  { method: 'PATCH', path: '/api/me', module: 'Auth', auth: 'Authenticated', description: 'Persist caller profile updates to database' },
  { method: 'GET', path: '/api/workspace', module: 'Workspace', auth: 'Authenticated', description: 'Hydrate saved schemes, alerts, schedules, notifications & settings' },
  { method: 'PUT', path: '/api/workspace', module: 'Workspace', auth: 'Authenticated', description: 'Persist saved schemes, applications, mandi alerts & reminders' },
  { method: 'GET', path: '/api/backend/status', module: 'Database', auth: 'Admin only', description: 'SQLite WAL / DynamoDB table health, counts & runtime readiness' },
  { method: 'GET', path: '/api/backend/records?entity=cropCases', module: 'Database', auth: 'Admin only', description: 'Inspect live records across all 8 database entities' },
  { method: 'POST', path: '/api/backend/health-check', module: 'Database', auth: 'Admin only', description: 'Run live integrity check (SQLite PRAGMA / DynamoDB DescribeTable)' },
  { method: 'GET', path: '/api/backend/export', module: 'Database', auth: 'Admin only', description: 'Download sanitized JSON database snapshot' },
  { method: 'POST', path: '/api/backend/ensure-table', module: 'Database', auth: 'Admin only', description: 'Verify or provision DynamoDB single-table & GSIs' },
  { method: 'POST', path: '/api/backend/seed', module: 'Database', auth: 'Admin only', description: 'Seed missing or reset demo dataset in active database' },
  { method: 'GET', path: '/api/crop-cases?limit=25', module: 'CropDoctor AI', auth: 'Authenticated', description: 'Role-scoped crop diagnosis cases' },
  { method: 'GET', path: '/api/mandi/prices?limit=25', module: 'MandiSmart', auth: 'Authenticated', description: 'Query agricultural mandi market prices' },
  { method: 'GET', path: '/api/farms?limit=20', module: 'JalSense', auth: 'Authenticated', description: 'Fetch farms & plot irrigation state' },
  { method: 'PUT', path: '/api/farms/{id}', module: 'JalSense', auth: 'Authenticated', description: 'Persist farm plot edits & irrigation metadata' },
  { method: 'GET', path: '/api/storage-batches?limit=25', module: 'GrainGuard', auth: 'Authenticated', description: 'Storage batch telemetry & threshold status' },
  { method: 'GET', path: '/api/storage-batches/{id}/readings', module: 'GrainGuard', auth: 'Authenticated', description: 'Fetch persisted temperature & humidity readings' },
  { method: 'GET', path: '/api/schemes?limit=25', module: 'SchemeSaathi', auth: 'Authenticated', description: 'Government schemes & eligibility catalog' },
  { method: 'POST', path: '/api/schemes', module: 'SchemeSaathi', auth: 'Admin only', description: 'Create or update government scheme entry' },
  { method: 'PUT', path: '/api/admin/settings', module: 'Governance', auth: 'Admin only', description: 'Persist platform configuration & SLA thresholds' },
  { method: 'GET', path: '/api/audit-logs?limit=25', module: 'Governance', auth: 'Admin only', description: 'Immutable mutation & review audit trail' },
];

function sanitizeAwsFailure(err: unknown): string {
  const name = err instanceof Error ? err.name : 'UnknownError';
  if (name === 'CredentialsProviderError' || name === 'UnrecognizedClientException') {
    return 'AWS credentials are missing or invalid in server environment Secrets.';
  }
  if (name === 'AccessDeniedException') {
    return 'Configured AWS IAM principal lacks DynamoDB DescribeTable/CreateTable permissions.';
  }
  if (name === 'TimeoutError' || name === 'NetworkingError') {
    return 'Unable to reach AWS DynamoDB endpoint from server.';
  }
  return `DynamoDB check returned ${name}.`;
}

export async function inspectDynamoTable(
  config: AppConfig,
  targetTableName: string = config.flagTableName,
): Promise<DynamoTableInspection> {
  if (!config.awsCredentialsConfigured) {
    return {
      reachable: false,
      tableStatus: 'NOT_CONFIGURED',
      billingMode: null,
      approximateItemCount: null,
      gsiNames: ['gsi1', 'gsi2'],
      message:
        config.dataBackend === 'dynamodb'
          ? 'DATA_BACKEND=dynamodb is enabled, but AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are not set.'
          : config.dataBackend === 'sqlite'
            ? `Running on persistent local SQLite 2-table database (krishi_users + krishi_flag_items). Set AWS credentials and DATA_BACKEND=dynamodb to switch to AWS DynamoDB (${config.usersTableName} & ${config.flagTableName}).`
            : 'Running on local in-memory store. Set DATA_BACKEND=sqlite for local persistence or AWS credentials + DATA_BACKEND=dynamodb for AWS.',
    };
  }

  try {
    const client = getBaseDynamoClient(config);
    const res = await client.send(new DescribeTableCommand({ TableName: targetTableName }));
    const table = res.Table;
    const rawStatus = table?.TableStatus;
    const tableStatus: TableState =
      rawStatus === 'ACTIVE'
        ? 'ACTIVE'
        : rawStatus === 'CREATING'
          ? 'CREATING'
          : rawStatus === 'UPDATING'
            ? 'UPDATING'
            : 'UNREACHABLE';
    return {
      reachable: true,
      tableStatus,
      billingMode: table?.BillingModeSummary?.BillingMode ?? 'PAY_PER_REQUEST',
      approximateItemCount: table?.ItemCount ?? 0,
      gsiNames: (table?.GlobalSecondaryIndexes ?? []).map((g) => g.IndexName ?? '').filter(Boolean),
      message: `Connected to DynamoDB table "${targetTableName}" (${tableStatus}) in ${config.awsRegion}.`,
    };
  } catch (err) {
    if (err instanceof ResourceNotFoundException) {
      return {
        reachable: true,
        tableStatus: 'NOT_FOUND',
        billingMode: null,
        approximateItemCount: null,
        gsiNames: [],
        message: `AWS credentials reachable in ${config.awsRegion}, but table "${targetTableName}" does not exist yet.`,
      };
    }
    return {
      reachable: false,
      tableStatus: 'UNREACHABLE',
      billingMode: null,
      approximateItemCount: null,
      gsiNames: [],
      message: sanitizeAwsFailure(err),
    };
  }
}

async function ensureSingleDynamoTable(
  config: AppConfig,
  targetTableName: string,
): Promise<DynamoTableInspection> {
  const current = await inspectDynamoTable(config, targetTableName);
  if (current.tableStatus === 'ACTIVE') return current;

  const client = getBaseDynamoClient(config);
  if (current.tableStatus === 'NOT_FOUND') {
    try {
      await client.send(
        new CreateTableCommand({
          TableName: targetTableName,
          BillingMode: 'PAY_PER_REQUEST',
          AttributeDefinitions: [
            { AttributeName: 'pk', AttributeType: 'S' },
            { AttributeName: 'sk', AttributeType: 'S' },
            { AttributeName: 'gsi1pk', AttributeType: 'S' },
            { AttributeName: 'gsi1sk', AttributeType: 'S' },
            { AttributeName: 'gsi2pk', AttributeType: 'S' },
            { AttributeName: 'gsi2sk', AttributeType: 'S' },
          ],
          KeySchema: [
            { AttributeName: 'pk', KeyType: 'HASH' },
            { AttributeName: 'sk', KeyType: 'RANGE' },
          ],
          GlobalSecondaryIndexes: [
            {
              IndexName: 'gsi1',
              KeySchema: [
                { AttributeName: 'gsi1pk', KeyType: 'HASH' },
                { AttributeName: 'gsi1sk', KeyType: 'RANGE' },
              ],
              Projection: { ProjectionType: 'ALL' },
            },
            {
              IndexName: 'gsi2',
              KeySchema: [
                { AttributeName: 'gsi2pk', KeyType: 'HASH' },
                { AttributeName: 'gsi2sk', KeyType: 'RANGE' },
              ],
              Projection: { ProjectionType: 'ALL' },
            },
          ],
        }),
      );
      await waitUntilTableExists(
        { client, maxWaitTime: 20, minDelay: 1, maxDelay: 3 },
        { TableName: targetTableName },
      );
    } catch (err) {
      throw new ServiceUnavailableError('DYNAMODB_PROVISION_FAILED', sanitizeAwsFailure(err));
    }
  } else if (!current.reachable) {
    throw new ServiceUnavailableError('DYNAMODB_UNREACHABLE', current.message);
  }

  return inspectDynamoTable(config, targetTableName);
}

export async function ensureDynamoTable(config: AppConfig): Promise<DynamoTableInspection> {
  if (!config.awsCredentialsConfigured) {
    throw new ValidationError(
      'AWS credentials are not configured in server environment Secrets (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY).',
    );
  }

  const [usersDynamo, flagDynamo] = await Promise.all([
    ensureSingleDynamoTable(config, config.usersTableName),
    ensureSingleDynamoTable(config, config.flagTableName),
  ]);

  return {
    ...flagDynamo,
    message: `Verified 2 DynamoDB tables: "${config.usersTableName}" (${usersDynamo.tableStatus}) & "${config.flagTableName}" (${flagDynamo.tableStatus}) in ${config.awsRegion}.`,
  };
}

async function countAllEntities(repos: Repositories): Promise<Record<BackendEntityName, number>> {
  const page = { limit: 100 };
  const [cases, mandi, schemes, storage, farms, audit, users, notifications] = await Promise.all([
    repos.cases.listAll(page).catch(() => ({ items: [] })),
    repos.mandi.query({}, page).catch(() => ({ items: [] })),
    repos.schemes.list({}, page).catch(() => ({ items: [] })),
    repos.storage.listAll(page).catch(() => ({ items: [] })),
    repos.farms.listAll(page).catch(() => ({ items: [] })),
    repos.audit.list(page).catch(() => ({ items: [] })),
    repos.users.list(page).catch(() => ({ items: [] })),
    repos.workspace.listNotifications(page).catch(() => ({ items: [] })),
  ]);
  return {
    cropCases: cases.items.length,
    mandiPrices: mandi.items.length,
    schemes: schemes.items.length,
    storageBatches: storage.items.length,
    farms: farms.items.length,
    auditLogs: audit.items.length,
    users: users.items.length,
    notifications: notifications.items.length,
  };
}

export async function getBackendStatus(
  config: AppConfig,
  container: Container,
  runIntegrity = false,
): Promise<BackendStatusSnapshot> {
  const [usersDynamo, flagDynamo, counts] = await Promise.all([
    inspectDynamoTable(config, config.usersTableName),
    inspectDynamoTable(config, config.flagTableName),
    countAllEntities(container.repos),
  ]);
  const sqlite = config.dataBackend === 'sqlite' ? inspectSqliteDatabase(config, runIntegrity) : undefined;
  const dynamo: DynamoTableInspection = config.awsCredentialsConfigured
    ? {
        ...flagDynamo,
        reachable: usersDynamo.reachable && flagDynamo.reachable,
        tableStatus:
          usersDynamo.tableStatus === 'ACTIVE' && flagDynamo.tableStatus === 'ACTIVE'
            ? 'ACTIVE'
            : usersDynamo.tableStatus === 'NOT_FOUND' || flagDynamo.tableStatus === 'NOT_FOUND'
              ? 'NOT_FOUND'
              : flagDynamo.tableStatus,
        message: `Users Table "${config.usersTableName}": ${usersDynamo.tableStatus} | Flag Table "${config.flagTableName}": ${flagDynamo.tableStatus}`,
      }
    : flagDynamo;

  return {
    service: 'krishi360-ai-backend',
    dataBackend: config.dataBackend,
    awsRegion: config.awsRegion,
    usersTableName: config.usersTableName,
    flagTableName: config.flagTableName,
    tableName: config.flagTableName,
    customEndpointConfigured: Boolean(config.dynamoEndpoint),
    awsCredentialsConfigured: config.awsCredentialsConfigured,
    s3UploadsConfigured: Boolean(config.uploadBucketName),
    aiProvider: config.aiProvider,
    authMode: config.authMode,
    dynamo,
    usersDynamo,
    flagDynamo,
    ...(sqlite ? { sqlite } : {}),
    counts,
    singleTableSchema: SINGLE_TABLE_SCHEMA,
    endpoints: API_ENDPOINTS,
    checkedAt: new Date().toISOString(),
  };
}

export async function seedActiveDatabase(
  config: AppConfig,
  container: Container,
  actor: AuthUser,
  logger: Logger,
  options: SeedOptions = {},
): Promise<BackendStatusSnapshot> {
  if (config.dataBackend === 'dynamodb') {
    await ensureDynamoTable(config);
  }
  const seedResult = await seedDemoPortalData(container.repos, options);
  await container.audit.record(logger, actor, 'backend.database_seeded', config.tableName, {
    dataBackend: config.dataBackend,
    mode: options.mode ?? 'missing',
    inserted: seedResult.inserted,
    skipped: seedResult.skipped,
  });
  const status = await getBackendStatus(config, container);
  return { ...status, seedResult };
}

export async function runDatabaseHealthCheck(
  config: AppConfig,
  container: Container,
  actor: AuthUser,
  logger: Logger,
): Promise<BackendStatusSnapshot> {
  const status = await getBackendStatus(config, container, true);
  await container.audit.record(logger, actor, 'backend.health_checked', config.tableName, {
    dataBackend: config.dataBackend,
    sqliteIntegrityOk: status.sqlite?.integrityOk,
    dynamoStatus: status.dynamo.tableStatus,
  });
  return status;
}

export async function exportSanitizedDatabase(
  config: AppConfig,
  container: Container,
  actor: AuthUser,
  logger: Logger,
) {
  const page = { limit: 100 };
  const [cases, mandi, schemes, storage, farms, audit, users, notifications, settings] = await Promise.all([
    container.repos.cases.listAll(page),
    container.repos.mandi.query({}, page),
    container.repos.schemes.list({}, page),
    container.repos.storage.listAll(page),
    container.repos.farms.listAll(page),
    container.repos.audit.list(page),
    container.repos.users.list(page),
    container.repos.workspace.listNotifications(page),
    container.repos.workspace.getPlatformSettings(),
  ]);

  await container.audit.record(logger, actor, 'backend.database_exported', config.tableName, {
    dataBackend: config.dataBackend,
  });

  return {
    exportedAt: new Date().toISOString(),
    dataBackend: config.dataBackend,
    usersTableName: config.usersTableName,
    flagTableName: config.flagTableName,
    tableName: config.flagTableName,
    collections: {
      users: users.items.map(toPublicUser),
      cropCases: cases.items,
      mandiPrices: mandi.items,
      schemes: schemes.items,
      storageBatches: storage.items,
      farms: farms.items,
      notifications: notifications.items,
      auditLogs: audit.items,
      platformSettings: settings,
    },
  };
}

export async function listBackendRecords(
  repos: Repositories,
  entity: BackendEntityName,
  limit: number,
  cursor?: string,
) {
  const page = { limit, cursor };
  switch (entity) {
    case 'cropCases':
      return repos.cases.listAll(page);
    case 'mandiPrices':
      return repos.mandi.query({}, page);
    case 'schemes':
      return repos.schemes.list({}, page);
    case 'storageBatches':
      return repos.storage.listAll(page);
    case 'farms':
      return repos.farms.listAll(page);
    case 'auditLogs':
      return repos.audit.list(page);
    case 'users': {
      const res = await repos.users.list(page);
      return { ...res, items: res.items.map(toPublicUser) };
    }
    case 'notifications':
      return repos.workspace.listNotifications(page);
  }
}
