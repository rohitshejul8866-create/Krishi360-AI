import type { AuthUser, Role } from '../middleware/auth';
import type {
  IrrigationScheduleRecord,
  MandiAlertRecord,
  NotificationRecord,
  NotificationSeverity,
  PlatformSettingsRecord,
  SchemeApplicationRecord,
  UserPreferencesRecord,
  UserWorkspaceState,
} from '../models/workspace';
import type { WorkspaceRepository } from '../repositories/types';
import { makeId, nowIso } from '../utils/ids';
import type { Logger } from '../utils/logger';
import type { AuditService } from './auditService';

const DEFAULT_SETTINGS: Omit<PlatformSettingsRecord, 'updatedAt' | 'version'> = {
  id: 'global',
  language: 'English',
  notificationsEnabled: true,
  demoMode: true,
  compactTables: false,
  expertReviewSlaHours: 24,
  storageAlertTemp: 28,
  storageAlertHumidity: 70,
};

export interface WorkspacePatchInput {
  savedSchemeIds?: string[];
  applications?: SchemeApplicationRecord[];
  mandiAlerts?: MandiAlertRecord[];
  irrigationSchedules?: IrrigationScheduleRecord[];
  customCrops?: string[];
  preferences?: UserPreferencesRecord;
}

export interface WorkspaceSnapshot {
  workspace: UserWorkspaceState;
  notifications: Array<NotificationRecord & { read: boolean }>;
  settings: PlatformSettingsRecord;
}

export class WorkspaceService {
  constructor(
    private repo: WorkspaceRepository,
    private audit: AuditService,
  ) {}

  private async ensureUserWorkspace(userId: string): Promise<UserWorkspaceState> {
    const existing = await this.repo.getUserWorkspace(userId);
    if (existing) return existing;

    const initial: UserWorkspaceState = {
      userId,
      savedSchemeIds: [],
      applications: [],
      mandiAlerts: [],
      irrigationSchedules: [],
      customCrops: [],
      updatedAt: nowIso(),
      version: 1,
    };
    await this.repo.saveUserWorkspace(initial);
    return initial;
  }

  async getSnapshot(user: AuthUser): Promise<WorkspaceSnapshot> {
    const [workspace, notifPage, settingsExisting] = await Promise.all([
      this.ensureUserWorkspace(user.id),
      this.repo.listNotifications({ limit: 100 }),
      this.repo.getPlatformSettings(),
    ]);

    const settings: PlatformSettingsRecord = settingsExisting ?? {
      ...DEFAULT_SETTINGS,
      updatedAt: nowIso(),
      version: 1,
    };

    const visibleNotifications = notifPage.items
      .filter((n) => {
        if (n.targetUserId) {
          return n.targetUserId === user.id || user.role === 'admin';
        }
        return user.role === 'admin' || n.audience === 'all' || n.audience === user.role;
      })
      .map((n) => ({
        ...n,
        read: n.readBy.includes(user.id),
      }));

    return {
      workspace,
      notifications: visibleNotifications,
      settings,
    };
  }

  async saveUserWorkspace(user: AuthUser, patch: WorkspacePatchInput): Promise<UserWorkspaceState> {
    const current = await this.ensureUserWorkspace(user.id);
    const next: UserWorkspaceState = {
      ...current,
      ...(patch.savedSchemeIds !== undefined ? { savedSchemeIds: patch.savedSchemeIds } : {}),
      ...(patch.applications !== undefined ? { applications: patch.applications } : {}),
      ...(patch.mandiAlerts !== undefined ? { mandiAlerts: patch.mandiAlerts } : {}),
      ...(patch.irrigationSchedules !== undefined ? { irrigationSchedules: patch.irrigationSchedules } : {}),
      ...(patch.customCrops !== undefined ? { customCrops: patch.customCrops } : {}),
      ...(patch.preferences !== undefined ? { preferences: patch.preferences } : {}),
      updatedAt: nowIso(),
      version: current.version + 1,
    };
    await this.repo.saveUserWorkspace(next);
    return next;
  }

  async createNotification(
    user: AuthUser,
    input: {
      title: string;
      body: string;
      severity: NotificationSeverity;
      audience: Role | 'all';
      targetUserId?: string;
    },
  ): Promise<NotificationRecord & { read: boolean }> {
    const requestedTarget = user.role === 'admin' ? input.targetUserId : undefined;
    const scopeToSelf =
      user.role !== 'admin' && (input.audience === user.role || input.audience === 'all');
    const targetUserId = requestedTarget ?? (scopeToSelf ? user.id : undefined);
    const record: NotificationRecord = {
      id: makeId('NOTIF'),
      title: input.title,
      body: input.body,
      severity: input.severity,
      audience: input.audience,
      ...(targetUserId ? { targetUserId } : {}),
      readBy: [],
      createdAt: nowIso(),
    };
    await this.repo.putNotification(record);
    return { ...record, read: record.readBy.includes(user.id) };
  }

  async markNotificationsRead(
    user: AuthUser,
    input: { id?: string; audience?: Role | 'all' },
  ): Promise<void> {
    const page = await this.repo.listNotifications({ limit: 100 });
    for (const item of page.items) {
      if (item.targetUserId && item.targetUserId !== user.id && user.role !== 'admin') continue;
      if (input.id && item.id !== input.id) continue;
      if (!input.id && input.audience && item.audience !== input.audience && item.audience !== 'all') continue;
      if (!item.readBy.includes(user.id)) {
        await this.repo.putNotification({
          ...item,
          readBy: [...item.readBy, user.id],
        });
      }
    }
  }

  async updatePlatformSettings(
    user: AuthUser,
    input: Omit<PlatformSettingsRecord, 'id' | 'updatedAt' | 'version'>,
    logger: Logger,
  ): Promise<PlatformSettingsRecord> {
    const existing = await this.repo.getPlatformSettings();
    const next: PlatformSettingsRecord = {
      id: 'global',
      ...input,
      updatedAt: nowIso(),
      version: (existing?.version ?? 0) + 1,
    };
    await this.repo.savePlatformSettings(next);
    await this.audit.record(logger, user, 'admin.settings_updated', 'SETTINGS#global', {
      language: next.language,
      expertReviewSlaHours: next.expertReviewSlaHours,
    });
    return next;
  }
}
