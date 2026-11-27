import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { buildAwsSdkOptions } from '../../config/awsClient';
import type { AppConfig } from '../../config/env';

let baseClient: DynamoDBClient | undefined;
let docClient: DynamoDBDocumentClient | undefined;

export function getBaseDynamoClient(config: AppConfig): DynamoDBClient {
  if (!baseClient) {
    baseClient = new DynamoDBClient({
      ...buildAwsSdkOptions(config),
      ...(config.dynamoEndpoint ? { endpoint: config.dynamoEndpoint } : {}),
    });
  }
  return baseClient;
}

/** Singleton per container. Credentials come from IAM role or server environment. */
export function getDocClient(config: AppConfig): DynamoDBDocumentClient {
  if (!docClient) {
    const base = getBaseDynamoClient(config);
    docClient = DynamoDBDocumentClient.from(base, {
      marshallOptions: { removeUndefinedValues: true },
    });
  }
  return docClient;
}

/** Test seam. */
export function setDocClient(client: DynamoDBDocumentClient | undefined): void {
  docClient = client;
  baseClient = undefined;
}