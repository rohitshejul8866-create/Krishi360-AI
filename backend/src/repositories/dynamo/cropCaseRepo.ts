import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { CaseStatus, CropCase } from '../../models/cropCase';
import { NotFoundError } from '../../utils/errors';
import type { Page, PageRequest } from '../../utils/pagination';
import type { CropCaseRepository } from '../types';
import { getItem, putItem, queryPage, scanPage, updateItem, type KeyAttrs } from './helpers';

export function caseKeys(c: CropCase): KeyAttrs {
  return {
    pk: `CASE#${c.id}`,
    sk: 'META',
    gsi1pk: `FARMER#${c.farmerId}`,
    gsi1sk: `${c.createdAt}#${c.id}`,
    gsi2pk: 'EXPERTQUEUE',
    gsi2sk: `${c.assignedExpertId ?? 'UNASSIGNED'}#${c.createdAt}#${c.id}`,
  };
}

export class DynamoCropCaseRepository implements CropCaseRepository {
  constructor(private client: DynamoDBDocumentClient, private table: string) {}

  create(item: CropCase): Promise<void> {
    return putItem(this.client, this.table, caseKeys(item), item);
  }

  get(id: string): Promise<CropCase | null> {
    return getItem<CropCase>(this.client, this.table, `CASE#${id}`);
  }

  async update(item: CropCase, expectedVersion: number): Promise<void> {
    await updateItem(this.client, this.table, caseKeys(item), item, expectedVersion);
  }

  listByFarmer(farmerId: string, page: PageRequest, status?: CaseStatus): Promise<Page<CropCase>> {
    return queryPage<CropCase>(this.client, this.table, {
      indexName: 'gsi1',
      keyCondition: 'gsi1pk = :owner',
      filter: status ? 'begins_with(pk, :pkPrefix) AND #data.#status = :status' : 'begins_with(pk, :pkPrefix)',
      names: status ? { '#data': 'data', '#status': 'status' } : {},
      values: {
        ':owner': `FARMER#${farmerId}`,
        ':pkPrefix': 'CASE#',
        ...(status ? { ':status': status } : {}),
      },
    }, page);
  }

  listForExpert(expertId: string, page: PageRequest, status?: CaseStatus): Promise<Page<CropCase>> {
    // Assigned cases (any status) + unassigned cases still in the review queue.
    const queue = '(attribute_not_exists(#data.#assigned) AND #data.#status IN (:qNew, :qAi, :qExpert))';
    const access = `(#data.#assigned = :me OR ${queue})`;
    const filter = status ? `${access} AND #data.#status = :status` : access;
    return queryPage<CropCase>(this.client, this.table, {
      indexName: 'gsi2',
      keyCondition: 'gsi2pk = :queue',
      filter,
      names: { '#data': 'data', '#assigned': 'assignedExpertId', '#status': 'status' },
      values: {
        ':queue': 'EXPERTQUEUE',
        ':me': expertId,
        ':qNew': 'new',
        ':qAi': 'ai_review',
        ':qExpert': 'expert_review',
        ...(status ? { ':status': status } : {}),
      },
    }, page);
  }

  listAll(page: PageRequest, status?: CaseStatus): Promise<Page<CropCase>> {
    const expression = status ? 'begins_with(pk, :prefix) AND #data.#status = :status' : 'begins_with(pk, :prefix)';
    return scanPage<CropCase>(this.client, this.table, page, {
      expression,
      names: { '#data': 'data', '#status': 'status' },
      values: { ':prefix': 'CASE#', ...(status ? { ':status': status } : {}) },
    });
  }
}

export async function getCaseOrThrow(repo: CropCaseRepository, id: string): Promise<CropCase> {
  const item = await repo.get(id);
  if (!item) throw new NotFoundError('Crop case not found.');
  return item;
}