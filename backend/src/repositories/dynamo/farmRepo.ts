import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { Farm, SoilReading } from '../../models/farm';
import type { Page, PageRequest } from '../../utils/pagination';
import type { FarmRepository } from '../types';
import { getItem, putItem, queryPage, scanPage, updateItem, type KeyAttrs } from './helpers';

function farmKeys(f: Farm): KeyAttrs {
  return {
    pk: `FARM#${f.id}`,
    sk: 'META',
    gsi1pk: `FARMER#${f.farmerId}`,
    gsi1sk: `${f.createdAt}#${f.id}`,
  };
}

export class DynamoFarmRepository implements FarmRepository {
  constructor(private client: DynamoDBDocumentClient, private table: string) {}

  create(item: Farm): Promise<void> {
    return putItem(this.client, this.table, farmKeys(item), item);
  }

  get(id: string): Promise<Farm | null> {
    return getItem<Farm>(this.client, this.table, `FARM#${id}`);
  }

  update(item: Farm, expectedVersion: number): Promise<void> {
    return updateItem(this.client, this.table, farmKeys(item), item, expectedVersion);
  }

  listByOwner(ownerId: string, page: PageRequest): Promise<Page<Farm>> {
    return queryPage<Farm>(this.client, this.table, {
      indexName: 'gsi1',
      keyCondition: 'gsi1pk = :owner',
      filter: 'begins_with(pk, :pkPrefix)',
      names: {},
      values: { ':owner': `FARMER#${ownerId}`, ':pkPrefix': 'FARM#' },
    }, page);
  }

  listAll(page: PageRequest): Promise<Page<Farm>> {
    return scanPage<Farm>(this.client, this.table, page, {
      expression: 'begins_with(pk, :prefix) AND sk = :meta',
      names: {},
      values: { ':prefix': 'FARM#', ':meta': 'META' },
    });
  }

  addReading(r: SoilReading): Promise<void> {
    return putItem(this.client, this.table, { pk: `FARM#${r.farmId}`, sk: `READING#${r.createdAt}#${r.id}` }, r);
  }

  listReadings(farmId: string, plotId: string | undefined, page: PageRequest): Promise<Page<SoilReading>> {
    return queryPage<SoilReading>(this.client, this.table, {
      keyCondition: 'pk = :farm AND begins_with(sk, :prefix)',
      ...(plotId ? { filter: '#data.#plotId = :plotId' } : {}),
      names: { '#data': 'data', '#plotId': 'plotId' },
      values: { ':farm': `FARM#${farmId}`, ':prefix': 'READING#', ...(plotId ? { ':plotId': plotId } : {}) },
    }, page);
  }
}