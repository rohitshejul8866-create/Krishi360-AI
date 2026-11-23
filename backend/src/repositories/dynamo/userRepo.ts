import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { Role } from '../../middleware/auth';
import type { UserAccount } from '../../models/user';
import type { Page, PageRequest } from '../../utils/pagination';
import type { UserRepository } from '../types';
import { getItem, putItem, queryPage, scanPage, updateItem, type KeyAttrs } from './helpers';

function userKeys(u: UserAccount): KeyAttrs {
  return {
    pk: `USER#${u.id}`,
    sk: 'META',
    gsi1pk: `EMAIL#${u.email.toLowerCase()}`,
    gsi1sk: `USER#${u.id}`,
    gsi2pk: `ROLE#${u.role}`,
    gsi2sk: `${u.createdAt}#${u.id}`,
  };
}

export class DynamoUserRepository implements UserRepository {
  constructor(private client: DynamoDBDocumentClient, private table: string) {}

  create(item: UserAccount): Promise<void> {
    return putItem(this.client, this.table, userKeys(item), item);
  }

  get(id: string): Promise<UserAccount | null> {
    return getItem<UserAccount>(this.client, this.table, `USER#${id}`);
  }

  async getByEmail(email: string): Promise<UserAccount | null> {
    const res = await queryPage<UserAccount>(
      this.client,
      this.table,
      {
        indexName: 'gsi1',
        keyCondition: 'gsi1pk = :email',
        filter: 'begins_with(pk, :pkPrefix)',
        names: {},
        values: {
          ':email': `EMAIL#${email.trim().toLowerCase()}`,
          ':pkPrefix': 'USER#',
        },
      },
      { limit: 1 },
    );
    return res.items[0] ?? null;
  }

  update(item: UserAccount, expectedVersion: number): Promise<void> {
    return updateItem(this.client, this.table, userKeys(item), item, expectedVersion);
  }

  list(page: PageRequest, role?: Role): Promise<Page<UserAccount>> {
    if (role) {
      return queryPage<UserAccount>(
        this.client,
        this.table,
        {
          indexName: 'gsi2',
          keyCondition: 'gsi2pk = :role',
          filter: 'begins_with(pk, :pkPrefix)',
          names: {},
          values: { ':role': `ROLE#${role}`, ':pkPrefix': 'USER#' },
        },
        page,
      );
    }
    return scanPage<UserAccount>(this.client, this.table, page, {
      expression: 'begins_with(pk, :prefix) AND sk = :meta',
      names: {},
      values: { ':prefix': 'USER#', ':meta': 'META' },
    });
  }
}
