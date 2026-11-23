import type { Role } from '../middleware/auth';

export type NotificationSeverity = 'info' | 'success' | 'warning' | 'critical';

export interface NotificationRecord {
  id: string;
  title: string;
  body: string;
  severity: NotificationSeverity;
  audience: Role | 'all';
  readBy: string[];
  createdAt: string;
}

export interface SchemeApplicationRecord {
  id: string;
  schemeId: string;
  farmerId: string;
  progress: number;
  stage: string;
  updatedAt: string;
}

export interface MandiAlertRecord {
  id: string;
  crop: string;
  district: string;
  targetPrice: number;
  createdAt: string;
}

export interface IrrigationScheduleRecord {
  id: string;
  plot: string;
  crop: string;
  stage: string;
  nextDate: string;
  waterLitres?: number;
  reminder: boolean;
}

export interface UserWorkspaceState {
  userId: string;
  savedSchemeIds: string[];
  applications: SchemeApplicationRecord[];
  mandiAlerts: MandiAlertRecord[];
  irrigationSchedules: IrrigationScheduleRecord[];
  updatedAt: string;
  version: number;
}

export interface PlatformSettingsRecord {
  id: 'global';
  language: string;
  notificationsEnabled: boolean;
  demoMode: boolean;
  compactTables: boolean;
  expertReviewSlaHours: number;
  storageAlertTemp: number;
  storageAlertHumidity: number;
  updatedAt: string;
  version: number;
}
