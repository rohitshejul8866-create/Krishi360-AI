import type { APIGatewayProxyResult } from 'aws-lambda';
import type { AppConfig } from '../config/env';
import type { ApiEnvelope, ApiErrorBody } from '../types/api';
import { AppError } from './errors';
import { nowIso } from './ids';

export const API_SOURCE = 'krishi360-api';

const SECURITY_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'no-store',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
};

export function corsHeaders(config: AppConfig, origin: string | undefined): Record<string, string> {
  if (!origin || !config.allowedOrigins.includes(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  };
}

export function successResponse<T>(
  data: T,
  opts: { status?: number; simulated?: boolean; requestId: string; config: AppConfig; origin?: string },
): APIGatewayProxyResult {
  const envelope: ApiEnvelope<T> = {
    data,
    meta: { source: API_SOURCE, simulated: opts.simulated === true, timestamp: nowIso() },
  };
  return {
    statusCode: opts.status ?? 200,
    headers: {
      ...SECURITY_HEADERS,
      ...corsHeaders(opts.config, opts.origin),
      'X-Request-Id': opts.requestId,
    },
    body: JSON.stringify(envelope),
  };
}

export function errorResponse(
  err: unknown,
  opts: { requestId: string; config: AppConfig; origin?: string },
): APIGatewayProxyResult {
  const appErr =
    err instanceof AppError
      ? err
      : new AppError(500, 'INTERNAL_ERROR', 'An unexpected error occurred. Please try again later.');
  const body: ApiErrorBody = {
    error: {
      code: appErr.code,
      message: appErr.message,
      ...(appErr.details !== undefined ? { details: appErr.details } : {}),
      requestId: opts.requestId,
    },
  };
  return {
    statusCode: appErr.statusCode,
    headers: {
      ...SECURITY_HEADERS,
      ...corsHeaders(opts.config, opts.origin),
      'X-Request-Id': opts.requestId,
    },
    body: JSON.stringify(body),
  };
}