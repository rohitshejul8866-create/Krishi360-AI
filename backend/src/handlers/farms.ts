import type { AppConfig } from '../config/env';
import type { Container } from '../container';
import { getContainer } from '../container';
import { withHttp } from '../middleware/withHttp';
import { farmCreateSchema, farmUpdateSchema, idParam, paginationQuery, readingsQuerySchema, soilReadingSchema } from '../validators';
import type { Route } from './router';
import { lazyRouter } from './router';

export function buildJalSenseRoutes(config: AppConfig, container: Container): Route[] {
  const svc = container.jalSense;
  return [
    {
      method: 'POST',
      resource: '/farms',
      handler: withHttp(
        { auth: 'required', roles: ['farmer', 'admin'], body: farmCreateSchema },
        config,
        async (ctx) => ({ status: 201, data: await svc.createFarm(ctx.user!, ctx.body, ctx.logger) }),
      ),
    },
    {
      method: 'GET',
      resource: '/farms',
      handler: withHttp({ auth: 'required', query: paginationQuery }, config, async (ctx) => ({
        data: await svc.listFarms(ctx.user!, { limit: ctx.query.limit, cursor: ctx.query.cursor }),
      })),
    },
    {
      method: 'GET',
      resource: '/farms/{id}',
      handler: withHttp({ auth: 'required', params: idParam }, config, async (ctx) => ({
        data: await svc.getFarm(ctx.user!, ctx.params.id),
      })),
    },
    {
      method: 'PUT',
      resource: '/farms/{id}',
      handler: withHttp(
        { auth: 'required', roles: ['farmer', 'admin'], params: idParam, body: farmUpdateSchema },
        config,
        async (ctx) => ({
          data: await svc.updateFarm(ctx.user!, ctx.params.id, ctx.body, ctx.logger),
        }),
      ),
    },
    {
      method: 'POST',
      resource: '/farms/{id}/readings',
      handler: withHttp(
        { auth: 'required', roles: ['farmer', 'admin'], params: idParam, body: soilReadingSchema },
        config,
        async (ctx) => {
          const reading = await svc.addReading(ctx.user!, ctx.params.id, ctx.body, ctx.logger);
          return { status: 201, data: reading, simulated: reading.source === 'simulated' };
        },
      ),
    },
    {
      method: 'GET',
      resource: '/farms/{id}/readings',
      handler: withHttp({ auth: 'required', params: idParam, query: readingsQuerySchema }, config, async (ctx) => ({
        data: await svc.listReadings(ctx.user!, ctx.params.id, ctx.query.plotId, {
          limit: ctx.query.limit,
          cursor: ctx.query.cursor,
        }),
      })),
    },
  ];
}

export const handler = lazyRouter(() => {
  const container = getContainer();
  return { routes: buildJalSenseRoutes(container.config, container), config: container.config };
});