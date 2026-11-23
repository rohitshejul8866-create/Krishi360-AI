import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { AuditEntry } from '../../models/audit';
import { dateKey } from '../../utils/ids';
import type { Page, PageRequest } from '../../utils/pagination';
import type { AuditRepository } from '../types';
import { putItem, queryPage, scanPage } from './helpers';

export class DynamoAuditRepository implements AuditRepository {
  constructor(private client: DynamoDBDocumentClient, private table: string) {}

  put(entry: AuditEntry): Promise<void> {
    return putItem(
      this.client,
      this.table,
      {
        pk: `AUDIT#${dateKey(entry.timestamp)}`,
        sk: `${entry.timestamp}#${entry.id}`,
        gsi1pk: `ACTOR#${entry.actorId}`,
        gsi1sk: entry.timestamp,
      },
      entry,
    );
  }

  list(page: PageRequest, actorId?: string): Promise<Page<AuditEntry>> {
    if (actorId) {
      return queryPage<AuditEntry>(this.client, this.table, {
        indexName: 'gsi1',
        keyCondition: 'gsi1pk = :actor',
        names: {},
        values: { ':actor': `ACTOR#${actorId}` },
      }, page);
    }
    // Admin-only, low volume: bounded scan. At scale, query recent day partitions.
    return scanPage<AuditEntry>(this.client, this.table, page, {
      expression: 'begins_with(pk, :prefix)',
      names: {},
      values: { ':prefix': 'AUDIT#' },
    });
  }
}