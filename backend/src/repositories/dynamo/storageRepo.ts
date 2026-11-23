import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { Inspection, StorageAlert, StorageBatch, StorageReading } from '../../models/storage';
import type { Page, PageRequest } from '../../utils/pagination';
import type { StorageRepository } from '../types';
import { getItem, putItem, queryPage, scanPage, updateItem, type KeyAttrs } from './helpers';

function batchKeys(b: StorageBatch): KeyAttrs {
  return {
    pk: `BATCH#${b.id}`,
    sk: 'META',
    gsi1pk: `FARMER#${b.ownerId}`,
    gsi1sk: `${b.createdAt}#${b.id}`,
  };
}

export class DynamoStorageRepository implements StorageRepository {
  constructor(private client: DynamoDBDocumentClient, private table: string) {}

  createBatch(item: StorageBatch): Promise<void> {
    return putItem(this.client, this.table, batchKeys(item), item);
  }

  getBatch(id: string): Promise<StorageBatch | null> {
    return getItem<StorageBatch>(this.client, this.table, `BATCH#${id}`);
  }

  updateBatch(item: StorageBatch, expectedVersion: number): Promise<void> {
    return updateItem(this.client, this.table, batchKeys(item), item, expectedVersion);
  }

  listByOwner(ownerId: string, page: PageRequest): Promise<Page<StorageBatch>> {
    return queryPage<StorageBatch>(this.client, this.table, {
      indexName: 'gsi1',
      keyCondition: 'gsi1pk = :owner',
      filter: 'begins_with(pk, :pkPrefix)',
      names: {},
      values: { ':owner': `FARMER#${ownerId}`, ':pkPrefix': 'BATCH#' },
    }, page);
  }

  listAll(page: PageRequest): Promise<Page<StorageBatch>> {
    return scanPage<StorageBatch>(this.client, this.table, page, {
      expression: 'begins_with(pk, :prefix) AND sk = :meta',
      names: {},
      values: { ':prefix': 'BATCH#', ':meta': 'META' },
    });
  }

  addReading(r: StorageReading): Promise<void> {
    return putItem(this.client, this.table, { pk: `BATCH#${r.batchId}`, sk: `READING#${r.createdAt}#${r.id}` }, r);
  }

  listReadings(batchId: string, page: PageRequest): Promise<Page<StorageReading>> {
    return queryPage<StorageReading>(this.client, this.table, {
      keyCondition: 'pk = :batch AND begins_with(sk, :prefix)',
      names: {},
      values: { ':batch': `BATCH#${batchId}`, ':prefix': 'READING#' },
    }, page);
  }

  addAlert(a: StorageAlert): Promise<void> {
    return putItem(this.client, this.table, { pk: `BATCH#${a.batchId}`, sk: `ALERT#${a.createdAt}#${a.id}` }, a);
  }

  listAlerts(batchId: string, page: PageRequest): Promise<Page<StorageAlert>> {
    return queryPage<StorageAlert>(this.client, this.table, {
      keyCondition: 'pk = :batch AND begins_with(sk, :prefix)',
      names: {},
      values: { ':batch': `BATCH#${batchId}`, ':prefix': 'ALERT#' },
    }, page);
  }

  addInspection(i: Inspection): Promise<void> {
    return putItem(this.client, this.table, { pk: `BATCH#${i.batchId}`, sk: `INSPECTION#${i.createdAt}#${i.id}` }, i);
  }

  async listInspections(batchId: string): Promise<Inspection[]> {
    const page = await queryPage<Inspection>(this.client, this.table, {
      keyCondition: 'pk = :batch AND begins_with(sk, :prefix)',
      names: {},
      values: { ':batch': `BATCH#${batchId}`, ':prefix': 'INSPECTION#' },
    }, { limit: 100 });
    return page.items;
  }
}