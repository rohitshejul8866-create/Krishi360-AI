import { PutCommand, type DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { Scheme } from '../../models/scheme';
import type { Page, PageRequest } from '../../utils/pagination';
import type { SchemeFilters, SchemeRepository } from '../types';
import { getItem, queryPage, scanPage } from './helpers';

function keys(s: Scheme) {
  return {
    pk: `SCHEME#${s.id}`,
    sk: 'META',
    gsi1pk: `CATEGORY#${s.category}`,
    gsi1sk: `${s.state}#${s.name}#${s.id}`,
  };
}

/** Lower-cased search blob stored alongside the entity for `contains` filters. */
function searchText(s: Scheme): string {
  return [s.name, s.summary, s.category, ...s.tags].join(' ').toLowerCase();
}

export class DynamoSchemeRepository implements SchemeRepository {
  constructor(private client: DynamoDBDocumentClient, private table: string) {}

  async put(item: Scheme): Promise<void> {
    await this.client.send(
      new PutCommand({
        TableName: this.table,
        Item: { ...keys(item), searchText: searchText(item), data: item },
      }),
    );
  }

  get(id: string): Promise<Scheme | null> {
    return getItem<Scheme>(this.client, this.table, `SCHEME#${id}`);
  }

  list(filters: SchemeFilters, page: PageRequest): Promise<Page<Scheme>> {
    const names: Record<string, string> = { '#data': 'data', '#state': 'state' };
    const values: Record<string, unknown> = {};
    const expr: string[] = [];

    if (filters.state) {
      values[':state'] = filters.state;
      values[':allIndia'] = 'All India';
      expr.push('(#data.#state = :state OR #data.#state = :allIndia)');
    }
    if (filters.q) {
      names['#search'] = 'searchText';
      values[':q'] = filters.q.toLowerCase();
      expr.push('contains(#search, :q)');
    }

    if (filters.category) {
      return queryPage<Scheme>(this.client, this.table, {
        indexName: 'gsi1',
        keyCondition: 'gsi1pk = :category',
        ...(expr.length ? { filter: expr.join(' AND ') } : {}),
        names,
        values: { ...values, ':category': `CATEGORY#${filters.category}` },
        scanForward: true,
      }, page);
    }

    // Small catalogue: bounded scan is acceptable (see DATABASE_SCHEMA.md).
    return scanPage<Scheme>(this.client, this.table, page, {
      expression: ['begins_with(pk, :prefix)', ...expr].join(' AND '),
      names,
      values: { ...values, ':prefix': 'SCHEME#' },
    });
  }
}