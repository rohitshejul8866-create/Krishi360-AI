import type { AppConfig } from '../config/env';
import type { Container } from '../container';
import { getContainer } from '../container';
import { withHttp } from '../middleware/withHttp';
import {
  notificationCreateSchema,
  notificationReadSchema,
  platformSettingsSchema,
  workspaceSaveSchema,
} from '../validators';
import type { Route } from './router';
import { lazyRouter } from './router';

export function buildWorkspaceRoutes(config: AppConfig, container: Container): Route[] {
  const svc = container.workspace;
  return [
    {
      method: 'GET',
      resource: '/workspace',
      handler: withHttp({ auth: 'required' }, config, async (ctx) => ({
        data: await svc.getSnapshot(ctx.user!),
      })),
    },
    {
      method: 'PUT',
      resource: '/workspace',
      handler: withHttp({ auth: 'required', body: workspaceSaveSchema }, config, async (ctx) => ({
        data: await svc.saveUserWorkspace(ctx.user!, ctx.body),
      })),
    },
    {
      method: 'POST',
      resource: '/notifications',
      handler: withHttp({ auth: 'required', body: notificationCreateSchema }, config, async (ctx) => ({
        status: 201,
        data: await svc.createNotification(ctx.user!, ctx.body),
      })),
    },
    {
      method: 'POST',
      resource: '/notifications/read',
      handler: withHttp({ auth: 'required', body: notificationReadSchema }, config, async (ctx) => {
        await svc.markNotificationsRead(ctx.user!, ctx.body);
        return { data: { ok: true } };
      }),
    },
    {
      method: 'PUT',
      resource: '/admin/settings',
      handler: withHttp(
        { auth: 'required', roles: ['admin'], body: platformSettingsSchema },
        config,
        async (ctx) => ({
          data: await svc.updatePlatformSettings(ctx.user!, ctx.body, ctx.logger),
        }),
      ),
    },
  ];
}

export const handler = lazyRouter(() => {
  const container = getContainer();
  return { routes: buildWorkspaceRoutes(container.config, container), config: container.config };
});
