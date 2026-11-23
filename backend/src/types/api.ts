import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import type { ZodType } from 'zod';
import type { AuthUser } from '../middleware/auth';
import type { Logger } from '../utils/logger';

/** Matches the frontend `ApiEnvelope<T>` in frontend/src/types/index.ts. */
export interface ApiMeta {
  source: string;
  simulated: boolean;
  timestamp: string;
}

export interface ApiEnvelope<T> {
  data: T;
  meta: ApiMeta;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId: string;
  };
}

export interface Paginated<T> {
  items: T[];
  count: number;
  nextToken: string | null;
}

/** Context passed to every operation handler after auth + validation. */
export interface RequestContext<TBody = unknown, TQuery = unknown, TParams = unknown> {
  user: AuthUser | null;
  requestId: string;
  body: TBody;
  query: TQuery;
  params: TParams;
  logger: Logger;
  event: APIGatewayProxyEvent;
}

export interface OperationResult<T = unknown> {
  status?: number;
  data: T;
  /** True when the payload is sample/simulated data, never live-verified data. */
  simulated?: boolean;
}

export type OperationHandler<TBody = unknown, TQuery = unknown, TParams = unknown> = (
  ctx: RequestContext<TBody, TQuery, TParams>,
) => Promise<OperationResult>;

export interface ParseSchemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

export interface OperationOptions extends ParseSchemas {
  /** 'none' for public endpoints (health), 'required' otherwise. */
  auth: 'none' | 'required';
  roles?: ReadonlyArray<AuthUser['role']>;
}

export type LambdaHandler = (event: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult>;