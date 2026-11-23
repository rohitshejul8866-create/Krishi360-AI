import type { AppConfig } from '../config/env';
import type { Container } from '../container';
import { getContainer } from '../container';
import { withHttp } from '../middleware/withHttp';
import {
  ensureDynamoTable,
  exportSanitizedDatabase,
  getBackendStatus,
  listBackendRecords,
  runDatabaseHealthCheck,
  seedActiveDatabase,
} from '../services/awsDatabaseService';
import { backendRecordsQuerySchema, backendSeedBodySchema } from '../validators';
import type { Route } from './router';
import { lazyRouter } from './router';

export function buildBackendRoutes(config: AppConfig, container: Container): Route[] {
  return [
    {
      method: 'GET',
      resource: '/backend/status',
      handler: withHttp({ auth: 'required', roles: ['admin'] }, config, async () => ({
        data: await getBackendStatus(config, container),
      })),
    },
    {
      method: 'GET',
      resource: '/backend/records',
      handler: withHttp(
        { auth: 'required', roles: ['admin'], query: backendRecordsQuerySchema },
        config,
        async (ctx) => ({
          data: await listBackendRecords(
            container.repos,
            ctx.query.entity,
            ctx.query.limit,
            ctx.query.cursor,
          ),
        }),
      ),
    },
    {
      method: 'POST',
      resource: '/backend/health-check',
      handler: withHttp({ auth: 'required', roles: ['admin'] }, config, async (ctx) => ({
        data: await runDatabaseHealthCheck(config, container, ctx.user!, ctx.logger),
      })),
    },
    {
      method: 'GET',
      resource: '/backend/export',
      handler: withHttp({ auth: 'required', roles: ['admin'] }, config, async (ctx) => ({
        data: await exportSanitizedDatabase(config, container, ctx.user!, ctx.logger),
      })),
    },
    {
      method: 'POST',
      resource: '/backend/ensure-table',
      handler: withHttp({ auth: 'required', roles: ['admin'] }, config, async (ctx) => {
        const dynamo = await ensureDynamoTable(config);
        await container.audit.record(ctx.logger, ctx.user!, 'backend.dynamodb_table_verified', config.tableName, {
          tableStatus: dynamo.tableStatus,
          awsRegion: config.awsRegion,
        });
        return { data: await getBackendStatus(config, container) };
      }),
    },
    {
      method: 'POST',
      resource: '/backend/seed',
      handler: withHttp(
        { auth: 'required', roles: ['admin'], body: backendSeedBodySchema },
        config,
        async (ctx) => ({
          data: await seedActiveDatabase(config, container, ctx.user!, ctx.logger, {
            mode: ctx.body?.mode ?? 'missing',
          }),
        }),
      ),
    },
  ];
}

export const handler = lazyRouter(() => {
  const container = getContainer();
  return { routes: buildBackendRoutes(container.config, container), config: container.config };
});
