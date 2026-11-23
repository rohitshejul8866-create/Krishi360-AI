/**
 * Single-table DynamoDB helpers.
 *
 * Item shape: { pk, sk, gsi1pk?, gsi1sk?, gsi2pk?, gsi2sk?, data: <entity> }
 * The entity lives under `data` so key attributes never collide with fields.
 * GSIs use projection ALL (simple; revisit cost at scale — see DATABASE_SCHEMA.md).
 */

import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  type DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { ConflictError } from '../../utils/errors';
import { decodeCursor, encodeCursor, type Page, type PageRequest } from '../../utils/pagination';

export interface KeyAttrs {
  pk: string;
  sk: string;
  gsi1pk?: string;
  gsi1sk?: string;
  gsi2pk?: string;
  gsi2sk?: string;
}

export async function putItem<T extends object>(
  client: DynamoDBDocumentClient,
  table: string,
  keys: KeyAttrs,
  data: T,
): Promise<void> {
  await client.send(new PutCommand({ TableName: table, Item: { ...keys, data } }));
}

export async function getItem<T>(
  client: DynamoDBDocumentClient,
  table: string,
  pk: string,
  sk = 'META',
): Promise<T | null> {
  const res = await client.send(new GetCommand({ TableName: table, Key: { pk, sk }, ConsistentRead: true }));
  return (res.Item?.data as T | undefined) ?? null;
}

/** Full-item replace guarded by the entity's optimistic-lock version. */
export async function updateItem<T extends { version: number }>(
  client: DynamoDBDocumentClient,
  table: string,
  keys: KeyAttrs,
  data: T,
  expectedVersion: number,
): Promise<void> {
  try {
    await client.send(
      new PutCommand({
        TableName: table,
        Item: { ...keys, data },
        ConditionExpression: 'attribute_exists(pk) AND #data.#version = :expected',
        ExpressionAttributeNames: { '#data': 'data', '#version': 'version' },
        ExpressionAttributeValues: { ':expected': expectedVersion },
      }),
    );
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) throw new ConflictError();
    throw err;
  }
}

export interface QuerySpec {
  indexName?: string;
  keyCondition: string;
  filter?: string;
  names: Record<string, string>;
  values: Record<string, unknown>;
  scanForward?: boolean;
}

function mergeExpressions(spec: QuerySpec) {
  return {
    ...(spec.indexName ? { IndexName: spec.indexName } : {}),
    KeyConditionExpression: spec.keyCondition,
    ...(spec.filter ? { FilterExpression: spec.filter } : {}),
    ...(Object.keys(spec.names).length > 0 ? { ExpressionAttributeNames: spec.names } : {}),
    ...(Object.keys(spec.values).length > 0 ? { ExpressionAttributeValues: spec.values } : {}),
    ScanIndexForward: spec.scanForward ?? false,
  };
}

export async function queryPage<T>(
  client: DynamoDBDocumentClient,
  table: string,
  spec: QuerySpec,
  page: PageRequest,
): Promise<Page<T>> {
  const startKey = decodeCursor<Record<string, unknown>>(page.cursor);
  const res = await client.send(
    new QueryCommand({
      TableName: table,
      Limit: page.limit,
      ...(startKey ? { ExclusiveStartKey: startKey } : {}),
      ...mergeExpressions(spec),
    }),
  );
  return {
    items: (res.Items ?? []).map((i) => i.data as T),
    nextToken: res.LastEvaluatedKey ? encodeCursor(res.LastEvaluatedKey) : null,
  };
}

export async function scanPage<T>(
  client: DynamoDBDocumentClient,
  table: string,
  page: PageRequest,
  filter?: { expression: string; names: Record<string, string>; values: Record<string, unknown> },
): Promise<Page<T>> {
  const startKey = decodeCursor<Record<string, unknown>>(page.cursor);
  const res = await client.send(
    new ScanCommand({
      TableName: table,
      Limit: page.limit,
      ...(startKey ? { ExclusiveStartKey: startKey } : {}),
      ...(filter
        ? {
            FilterExpression: filter.expression,
            ...(Object.keys(filter.names).length > 0 ? { ExpressionAttributeNames: filter.names } : {}),
            ...(Object.keys(filter.values).length > 0 ? { ExpressionAttributeValues: filter.values } : {}),
          }
        : {}),
    }),
  );
  return {
    items: (res.Items ?? []).map((i) => i.data as T),
    nextToken: res.LastEvaluatedKey ? encodeCursor(res.LastEvaluatedKey) : null,
  };
}

export async function deleteItem(
  client: DynamoDBDocumentClient,
  table: string,
  pk: string,
  sk: string,
): Promise<void> {
  await client.send(new DeleteCommand({ TableName: table, Key: { pk, sk } }));
}