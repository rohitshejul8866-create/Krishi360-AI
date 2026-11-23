import type { AppConfig } from '../config/env';
import type { Container } from '../container';
import { getContainer } from '../container';
import { withHttp } from '../middleware/withHttp';
import { auditQuerySchema, eligibilityCheckSchema, idParam, schemeCreateSchema, schemeQuerySchema } from '../validators';
import type { Route } from './router';
import { lazyRouter } from './router';

export function buildSchemeRoutes(config: AppConfig, container: Container): Route[] {
  const svc = container.schemes;
  return [
    {
      method: 'GET',
      resource: '/schemes',
      handler: withHttp({ auth: 'required', query: schemeQuerySchema }, config, async (ctx) => {
        const { limit, cursor, ...filters } = ctx.query;
        const result = await svc.list(filters, { limit, cursor });
        return { data: result.page, simulated: result.simulated };
      }),
    },
    {
      method: 'POST',
      resource: '/schemes',
      handler: withHttp(
        { auth: 'required', roles: ['admin'], body: schemeCreateSchema },
        config,
        async (ctx) => ({
          status: 201,
          data: await svc.upsert(ctx.user!, ctx.body, ctx.logger),
          simulated: ctx.body.dataType === 'sample',
        }),
      ),
    },
    {
      // Declared before /schemes/{id} so the literal path wins in the router.
      method: 'POST',
      resource: '/schemes/eligibility-check',
      handler: withHttp({ auth: 'required', body: eligibilityCheckSchema }, config, async (ctx) => ({
        data: await svc.checkEligibility(ctx.body.schemeId, ctx.body.profile),
      })),
    },
    {
      method: 'GET',
      resource: '/schemes/{id}',
      handler: withHttp({ auth: 'required', params: idParam }, config, async (ctx) => {
        const result = await svc.get(ctx.params.id);
        return { data: result.scheme, simulated: result.simulated };
      }),
    },
  ];
}

export function buildAuditRoutes(config: AppConfig, container: Container): Route[] {
  return [
    {
      method: 'GET',
      resource: '/audit-logs',
      handler: withHttp({ auth: 'required', roles: ['admin'], query: auditQuerySchema }, config, async (ctx) => ({
        data: await container.audit.list({ limit: ctx.query.limit, cursor: ctx.query.cursor }, ctx.query.actorId),
      })),
    },
  ];
}

export const handler = lazyRouter(() => {
  const container = getContainer();
  return {
    routes: [...buildSchemeRoutes(container.config, container), ...buildAuditRoutes(container.config, container)],
    config: container.config,
  };
});