import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'node:crypto';
import type { AppConfig } from '../config/env';
import type { OperationHandler, RequestContext } from '../types/api';
import { AppError, UnauthorizedError, ValidationError } from '../utils/errors';
import { createLogger } from '../utils/logger';
import { corsHeaders, errorResponse, successResponse } from '../utils/response';
import { requireRole, resolveUser, type Role } from './auth';
import type { ZodType } from 'zod';

export interface HttpOptions<TBody, TQuery, TParams> {
  /** 'none' for public endpoints (health), 'required' otherwise. */
  auth: 'none' | 'required';
  roles?: ReadonlyArray<Role>;
  body?: ZodType<TBody>;
  query?: ZodType<TQuery>;
  params?: ZodType<TParams>;
}

function getHeader(event: APIGatewayProxyEvent, name: string): string | undefined {
  const lower = name.toLowerCase();
  for (const [k, v] of Object.entries(event.headers ?? {})) {
    if (k.toLowerCase() === lower && typeof v === 'string') return v;
  }
  return undefined;
}

function parseWith<T>(schema: ZodType<T>, value: unknown, source: string): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new ValidationError(`Invalid request ${source}.`, {
      issues: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  }
  return result.data;
}

function parseBody(raw: string | null): unknown {
  if (raw === null || raw === '') return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new ValidationError('Request body must be valid JSON.');
  }
}

/**
 * Wraps an operation with: request id, structured logging, CORS, security
 * headers, authentication, role checks, Zod validation and centralised error
 * handling. Handlers only contain business logic.
 */
export function withHttp<TBody = unknown, TQuery = unknown, TParams = unknown>(
  options: HttpOptions<TBody, TQuery, TParams>,
  config: AppConfig,
  handler: OperationHandler<TBody, TQuery, TParams>,
) {
  return async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const requestId = event.requestContext?.requestId ?? randomUUID();
    const origin = getHeader(event, 'origin');
    const logger = createLogger(config.logLevel, {
      requestId,
      route: `${event.httpMethod} ${event.resource ?? event.path}`,
    });

    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 204, headers: corsHeaders(config, origin), body: '' };
    }

    const started = Date.now();
    try {
      const user = options.auth === 'required' ? resolveUser(event, config) : null;
      if (options.auth === 'required') {
        if (!user) throw new UnauthorizedError();
        if (options.roles) requireRole(user, ...options.roles);
      }

      const ctx: RequestContext<TBody, TQuery, TParams> = {
        user,
        requestId,
        body: (options.body ? parseWith(options.body, parseBody(event.body), 'body') : parseBody(event.body)) as TBody,
        query: (options.query ? parseWith(options.query, event.queryStringParameters ?? {}, 'query') : (event.queryStringParameters ?? {})) as TQuery,
        params: (options.params ? parseWith(options.params, event.pathParameters ?? {}, 'path') : (event.pathParameters ?? {})) as TParams,
        logger: logger.child({ userId: user?.id, role: user?.role }),
        event,
      };

      const result = await handler(ctx);
      logger.info('request.completed', { status: result.status ?? 200, durationMs: Date.now() - started });
      return successResponse(result.data, {
        status: result.status,
        simulated: result.simulated,
        requestId,
        config,
        origin,
      });
    } catch (err) {
      if (err instanceof AppError) {
        logger.warn('request.failed', { code: err.code, status: err.statusCode, durationMs: Date.now() - started });
      } else {
        // Full detail stays in CloudWatch; the client gets a safe message.
        logger.error('request.error', {
          durationMs: Date.now() - started,
          errorName: err instanceof Error ? err.name : 'unknown',
          errorMessage: err instanceof Error ? err.message : String(err),
        });
      }
      return errorResponse(err, { requestId, config, origin });
    }
  };
}