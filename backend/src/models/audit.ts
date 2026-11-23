/** Audit trail for important operations. */

import type { Role } from '../middleware/auth';

export interface AuditEntry {
  id: string;
  actorId: string;
  actorRole: Role;
  action: string;
  target: string;
  /** Non-sensitive context only (ids, statuses). Never personal data. */
  details?: Record<string, unknown>;
  timestamp: string;
}