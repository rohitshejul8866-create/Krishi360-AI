import type { AppConfig } from '../config/env';
import type { Container } from '../container';
import { getContainer } from '../container';
import { withHttp } from '../middleware/withHttp';
import { requireRole } from '../middleware/auth';
import {
  analysisSchema,
  cropCaseCreateSchema,
  cropCaseListQuery,
  expertReviewSchema,
  idParam,
  uploadUrlSchema,
} from '../validators';
import type { Route } from './router';
import { lazyRouter } from './router';

export function buildCropDoctorRoutes(config: AppConfig, container: Container): Route[] {
  const svc = container.cropDoctor;
  return [
    {
      method: 'POST',
      resource: '/crop-cases',
      handler: withHttp(
        { auth: 'required', roles: ['farmer', 'admin'], body: cropCaseCreateSchema },
        config,
        async (ctx) => ({
          status: 201,
          data: await svc.createCase(requireRole(ctx.user, 'farmer', 'admin'), ctx.body, ctx.logger),
        }),
      ),
    },
    {
      method: 'GET',
      resource: '/crop-cases',
      handler: withHttp({ auth: 'required', query: cropCaseListQuery }, config, async (ctx) => ({
        data: await svc.listCases(ctx.user!, { limit: ctx.query.limit, cursor: ctx.query.cursor }, ctx.query.status),
      })),
    },
    {
      method: 'GET',
      resource: '/crop-cases/{id}',
      handler: withHttp({ auth: 'required', params: idParam }, config, async (ctx) => ({
        data: await svc.getCase(ctx.user!, ctx.params.id),
      })),
    },
    {
      method: 'POST',
      resource: '/crop-cases/{id}/upload-url',
      handler: withHttp(
        { auth: 'required', roles: ['farmer', 'admin'], params: idParam, body: uploadUrlSchema },
        config,
        async (ctx) => ({
          data: await svc.createUploadUrl(ctx.user!, ctx.params.id, ctx.body, ctx.logger),
        }),
      ),
    },
    {
      method: 'POST',
      resource: '/crop-cases/{id}/analysis',
      handler: withHttp(
        { auth: 'required', roles: ['farmer', 'admin'], params: idParam, body: analysisSchema },
        config,
        async (ctx) => {
          const result = await svc.requestAnalysis(ctx.user!, ctx.params.id, ctx.body.imageKey, ctx.logger);
          return { data: result, simulated: result.analysis.simulated };
        },
      ),
    },
    {
      method: 'POST',
      resource: '/crop-cases/{id}/expert-review',
      handler: withHttp(
        { auth: 'required', roles: ['expert', 'admin'], params: idParam, body: expertReviewSchema },
        config,
        async (ctx) => ({
          data: await svc.expertReview(ctx.user!, ctx.params.id, ctx.body, ctx.logger),
        }),
      ),
    },
  ];
}

export const handler = lazyRouter(() => {
  const container = getContainer();
  return { routes: buildCropDoctorRoutes(container.config, container), config: container.config };
});