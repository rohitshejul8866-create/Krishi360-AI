import type { AppConfig } from '../config/env';
import type { Container } from '../container';
import { getContainer } from '../container';
import { withHttp } from '../middleware/withHttp';
import { idParam, inspectionSchema, paginationQuery, storageBatchCreateSchema, storageReadingSchema } from '../validators';
import type { Route } from './router';
import { lazyRouter } from './router';

export function buildGrainGuardRoutes(config: AppConfig, container: Container): Route[] {
  const svc = container.grainGuard;
  return [
    {
      method: 'POST',
      resource: '/storage-batches',
      handler: withHttp(
        { auth: 'required', roles: ['farmer', 'admin'], body: storageBatchCreateSchema },
        config,
        async (ctx) => ({ status: 201, data: await svc.createBatch(ctx.user!, ctx.body, ctx.logger) }),
      ),
    },
    {
      method: 'GET',
      resource: '/storage-batches',
      handler: withHttp({ auth: 'required', query: paginationQuery }, config, async (ctx) => ({
        data: await svc.listBatches(ctx.user!, { limit: ctx.query.limit, cursor: ctx.query.cursor }),
      })),
    },
    {
      method: 'GET',
      resource: '/storage-batches/{id}',
      handler: withHttp({ auth: 'required', params: idParam }, config, async (ctx) => ({
        data: await svc.getBatch(ctx.user!, ctx.params.id),
      })),
    },
    {
      method: 'POST',
      resource: '/storage-batches/{id}/readings',
      handler: withHttp(
        { auth: 'required', roles: ['farmer', 'admin'], params: idParam, body: storageReadingSchema },
        config,
        async (ctx) => {
          const result = await svc.addReading(ctx.user!, ctx.params.id, ctx.body, ctx.logger);
          return { status: 201, data: result, simulated: ctx.body.source === 'simulated' };
        },
      ),
    },
    {
      method: 'GET',
      resource: '/storage-batches/{id}/alerts',
      handler: withHttp({ auth: 'required', params: idParam, query: paginationQuery }, config, async (ctx) => ({
        data: await svc.listAlerts(ctx.user!, ctx.params.id, { limit: ctx.query.limit, cursor: ctx.query.cursor }),
      })),
    },
    {
      method: 'POST',
      resource: '/storage-batches/{id}/inspections',
      handler: withHttp(
        { auth: 'required', roles: ['farmer', 'admin'], params: idParam, body: inspectionSchema },
        config,
        async (ctx) => ({
          status: 201,
          data: await svc.addInspection(ctx.user!, ctx.params.id, ctx.body, ctx.logger),
        }),
      ),
    },
  ];
}

export const handler = lazyRouter(() => {
  const container = getContainer();
  return { routes: buildGrainGuardRoutes(container.config, container), config: container.config };
});