import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { NotificationRecord, PlatformSettingsRecord, UserWorkspaceState } from '../../models/workspace';
import type { Page, PageRequest } from '../../utils/pagination';
import type { WorkspaceRepository } from '../types';
import { getItem, putItem, scanPage } from './helpers';

export class DynamoWorkspaceRepository implements WorkspaceRepository {
  constructor(private client: DynamoDBDocumentClient, private table: string) {}

  getUserWorkspace(userId: string): Promise<UserWorkspaceState | null> {
    return getItem<UserWorkspaceState>(this.client, this.table, `WORKSPACE#${userId}`);
  }

  saveUserWorkspace(state: UserWorkspaceState): Promise<void> {
    return putItem(
      this.client,
      this.table,
      {
        pk: `WORKSPACE#${state.userId}`,
        sk: 'META',
        gsi1pk: `WORKSPACE_USER#${state.userId}`,
        gsi1sk: state.updatedAt,
      },
      state,
    );
  }

  listNotifications(page: PageRequest): Promise<Page<NotificationRecord>> {
    return scanPage<NotificationRecord>(this.client, this.table, page, {
      expression: 'begins_with(pk, :prefix) AND sk = :meta',
      names: {},
      values: { ':prefix': 'NOTIF#', ':meta': 'META' },
    });
  }

  putNotification(item: NotificationRecord): Promise<void> {
    return putItem(
      this.client,
      this.table,
      {
        pk: `NOTIF#${item.id}`,
        sk: 'META',
        gsi1pk: `NOTIF_AUDIENCE#${item.audience}`,
        gsi1sk: `${item.createdAt}#${item.id}`,
      },
      item,
    );
  }

  getPlatformSettings(): Promise<PlatformSettingsRecord | null> {
    return getItem<PlatformSettingsRecord>(this.client, this.table, 'SETTINGS#global');
  }

  savePlatformSettings(settings: PlatformSettingsRecord): Promise<void> {
    return putItem(
      this.client,
      this.table,
      {
        pk: 'SETTINGS#global',
        sk: 'META',
      },
      settings,
    );
  }
}
