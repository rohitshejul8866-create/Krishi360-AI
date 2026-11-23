import type { AppConfig } from '../config/env';
import type { Container } from '../container';
import { getContainer } from '../container';
import { withHttp } from '../middleware/withHttp';
import { idParam, mandiCreateSchema, mandiQuerySchema } from '../validators';
import type { Route } from './router';
import { lazyRouter } from './router';

export function buildMandiRoutes(config: AppConfig, container: Container): Route[] {
  const svc = container.mandi;
  return [
    {
      method: 'GET',
      resource: '/mandi/prices',
      handler: withHttp({ auth: 'required', query: mandiQuerySchema }, config, async (ctx) => {
        const { limit, cursor, ...filters } = ctx.query;
        const result = await svc.list(filters, { limit, cursor });
        return { data: result.page, simulated: result.simulated };
      }),
    },
    {
      method: 'GET',
      resource: '/mandi/prices/{id}',
      handler: withHttp({ auth: 'required', params: idParam }, config, async (ctx) => {
        const result = await svc.get(ctx.params.id);
        return { data: result.price, simulated: result.simulated };
      }),
    },
    {
      method: 'POST',
      resource: '/mandi/prices',
      handler: withHttp(
        { auth: 'required', roles: ['admin'], body: mandiCreateSchema },
        config,
        async (ctx) => ({
          status: 201,
          data: await svc.create(ctx.user!, ctx.body, ctx.logger),
          simulated: ctx.body.dataType === 'sample',
        }),
      ),
    },
  ];
}

export const handler = lazyRouter(() => {
  const container = getContainer();
  return { routes: buildMandiRoutes(container.config, container), config: container.config };
});