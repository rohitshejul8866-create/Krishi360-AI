import type { AppConfig } from '../config/env';
import type { Container } from '../container';
import { getContainer } from '../container';
import { withHttp } from '../middleware/withHttp';
import {
  adminCreateUserSchema,
  adminSetupSchema,
  adminUserStatusSchema,
  adminUsersQuerySchema,
  farmerLoginSchema,
  farmerRegisterSchema,
  idParam,
  staffLoginSchema,
} from '../validators';
import type { Route } from './router';
import { lazyRouter } from './router';

export function buildAuthRoutes(config: AppConfig, container: Container): Route[] {
  const auth = container.auth;
  return [
    {
      method: 'GET',
      resource: '/health',
      handler: withHttp({ auth: 'none' }, config, async () => ({
        data: {
          status: 'ok',
          service: 'krishi360-ai-backend',
          version: '0.1.0',
          time: new Date().toISOString(),
          features: {
            aiProvider: config.aiProvider,
            uploadsConfigured: Boolean(config.uploadBucketName),
            dataBackend: config.dataBackend,
          },
        },
      })),
    },
    {
      method: 'GET',
      resource: '/me',
      handler: withHttp({ auth: 'required' }, config, async (ctx) => {
        const profile = await auth.getUserProfile(ctx.user!.id);
        return {
          data: profile ?? {
            id: ctx.user!.id,
            role: ctx.user!.role,
            name: ctx.user!.name ?? 'User',
            email: ctx.user!.email ?? '',
            groups: ctx.user!.groups,
          },
        };
      }),
    },
    {
      method: 'GET',
      resource: '/auth/bootstrap-status',
      handler: withHttp({ auth: 'none' }, config, async () => ({
        data: await auth.getBootstrapStatus(),
      })),
    },
    {
      method: 'POST',
      resource: '/auth/setup-admin',
      handler: withHttp({ auth: 'none', body: adminSetupSchema }, config, async (ctx) => ({
        status: 201,
        data: await auth.setupInitialAdmin(ctx.body, ctx.logger),
      })),
    },
    {
      method: 'POST',
      resource: '/auth/register',
      handler: withHttp({ auth: 'none', body: farmerRegisterSchema }, config, async (ctx) => ({
        status: 201,
        data: await auth.registerFarmer(ctx.body, ctx.logger),
      })),
    },
    {
      method: 'POST',
      resource: '/auth/login',
      handler: withHttp({ auth: 'none', body: farmerLoginSchema }, config, async (ctx) => ({
        data: await auth.loginFarmer(ctx.body, ctx.logger),
      })),
    },
    {
      method: 'POST',
      resource: '/auth/staff-login',
      handler: withHttp({ auth: 'none', body: staffLoginSchema }, config, async (ctx) => ({
        data: await auth.loginStaff(ctx.body, ctx.logger),
      })),
    },
    {
      method: 'GET',
      resource: '/admin/users',
      handler: withHttp(
        { auth: 'required', roles: ['admin'], query: adminUsersQuerySchema },
        config,
        async (ctx) => ({
          data: await auth.listUsers(
            { limit: ctx.query.limit, cursor: ctx.query.cursor },
            ctx.query.role,
          ),
        }),
      ),
    },
    {
      method: 'POST',
      resource: '/admin/users',
      handler: withHttp(
        { auth: 'required', roles: ['admin'], body: adminCreateUserSchema },
        config,
        async (ctx) => ({
          status: 201,
          data: await auth.createUserByAdmin(ctx.user!, ctx.body, ctx.logger),
        }),
      ),
    },
    {
      method: 'POST',
      resource: '/admin/users/{id}/status',
      handler: withHttp(
        { auth: 'required', roles: ['admin'], params: idParam, body: adminUserStatusSchema },
        config,
        async (ctx) => ({
          data: await auth.updateUserStatus(ctx.user!, ctx.params.id, ctx.body.status, ctx.logger),
        }),
      ),
    },
  ];
}

export const handler = lazyRouter(() => {
  const container = getContainer();
  return { routes: buildAuthRoutes(container.config, container), config: container.config };
});