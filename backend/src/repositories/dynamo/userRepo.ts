import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { Role } from '../../middleware/auth';
import {
  mergeUserAccount,
  splitUserAccount,
  type UserAccount,
  type UserLoginRecord,
  type UserProfileRecord,
} from '../../models/user';
import type { Page, PageRequest } from '../../utils/pagination';
import type { UserRepository } from '../types';
import { getItem, putItem, queryPage, scanPage, updateItem, type KeyAttrs } from './helpers';

function userLoginKeys(u: UserLoginRecord): KeyAttrs {
  return {
    pk: `USER#${u.id}`,
    sk: 'LOGIN',
    gsi1pk: `EMAIL#${u.email.toLowerCase()}`,
    gsi1sk: `USER#${u.id}`,
    gsi2pk: `ROLE#${u.role}`,
    gsi2sk: `${u.createdAt}#${u.id}`,
  };
}

function userProfileKeys(p: UserProfileRecord): KeyAttrs {
  return {
    pk: `USER_PROFILE#${p.id}`,
    sk: 'META',
    gsi1pk: `PROFILE#${p.id}`,
    gsi1sk: p.updatedAt,
  };
}

/**
 * 2-Table DynamoDB User Repository:
 * - Table 1 (`usersTable`): stores ONLY user login details (`UserLoginRecord`).
 * - Table 2 (`flagTable`): stores remaining user profile details (`UserProfileRecord`)
 *   alongside all other platform/domain details.
 */
export class DynamoUserRepository implements UserRepository {
  constructor(
    private client: DynamoDBDocumentClient,
    private usersTable: string,
    private flagTable: string,
  ) {}

  async create(item: UserAccount): Promise<void> {
    const { login, profile } = splitUserAccount(item);
    await putItem(this.client, this.usersTable, userLoginKeys(login), login);
    await putItem(this.client, this.flagTable, userProfileKeys(profile), profile);
  }

  async get(id: string): Promise<UserAccount | null> {
    const [login, profile] = await Promise.all([
      getItem<UserLoginRecord>(this.client, this.usersTable, `USER#${id}`, 'LOGIN'),
      getItem<UserProfileRecord>(this.client, this.flagTable, `USER_PROFILE#${id}`, 'META'),
    ]);
    if (!login) return null;
    return mergeUserAccount(login, profile);
  }

  async getByEmail(email: string): Promise<UserAccount | null> {
    const res = await queryPage<UserLoginRecord>(
      this.client,
      this.usersTable,
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
    const login = res.items[0];
    if (!login) return null;
    const profile = await getItem<UserProfileRecord>(
      this.client,
      this.flagTable,
      `USER_PROFILE#${login.id}`,
      'META',
    );
    return mergeUserAccount(login, profile);
  }

  async update(item: UserAccount, expectedVersion: number): Promise<void> {
    const { login, profile } = splitUserAccount(item);
    await updateItem(this.client, this.usersTable, userLoginKeys(login), login, expectedVersion);
    await putItem(this.client, this.flagTable, userProfileKeys(profile), profile);
  }

  async list(page: PageRequest, role?: Role): Promise<Page<UserAccount>> {
    const loginPage = role
      ? await queryPage<UserLoginRecord>(
          this.client,
          this.usersTable,
          {
            indexName: 'gsi2',
            keyCondition: 'gsi2pk = :role',
            filter: 'begins_with(pk, :pkPrefix)',
            names: {},
            values: { ':role': `ROLE#${role}`, ':pkPrefix': 'USER#' },
          },
          page,
        )
      : await scanPage<UserLoginRecord>(this.client, this.usersTable, page, {
          expression: 'begins_with(pk, :prefix) AND sk = :loginSk',
          names: {},
          values: { ':prefix': 'USER#', ':loginSk': 'LOGIN' },
        });

    const items = await Promise.all(
      loginPage.items.map(async (login) => {
        const profile = await getItem<UserProfileRecord>(
          this.client,
          this.flagTable,
          `USER_PROFILE#${login.id}`,
          'META',
        );
        return mergeUserAccount(login, profile);
      }),
    );

    return { items, nextToken: loginPage.nextToken };
  }
}
