import type { AuthUser } from '../middleware/auth';
import type { AuditEntry } from '../models/audit';
import type { AuditRepository } from '../repositories/types';
import { makeId, nowIso } from '../utils/ids';
import type { Logger } from '../utils/logger';

/**
 * Audit trail for important operations. Writes are best-effort: an audit
 * failure must not break the user operation, but it IS logged as an error.
 */
export class AuditService {
  constructor(private repo: AuditRepository) {}

  async record(
    logger: Logger,
    actor: AuthUser,
    action: string,
    target: string,
    details?: Record<string, unknown>,
  ): Promise<void> {
    const entry: AuditEntry = {
      id: makeId('AUD'),
      actorId: actor.id,
      actorRole: actor.role,
      action,
      target,
      ...(details ? { details } : {}),
      timestamp: nowIso(),
    };
    try {
      await this.repo.put(entry);
    } catch (err) {
      logger.error('audit.write_failed', {
        action,
        target,
        errorName: err instanceof Error ? err.name : 'unknown',
      });
    }
  }

  list(page: { limit: number; cursor?: string }, actorId?: string) {
    return this.repo.list(page, actorId);
  }
}