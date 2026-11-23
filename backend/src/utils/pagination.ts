import { ValidationError } from './errors';

export interface PageRequest {
  limit: number;
  cursor?: string;
}

export interface Page<T> {
  items: T[];
  nextToken: string | null;
}

export const DEFAULT_PAGE_LIMIT = 20;
export const MAX_PAGE_LIMIT = 100;

/** Cursors are opaque base64url JSON. Never trust their contents blindly. */
export function encodeCursor(payload: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function decodeCursor<T extends Record<string, unknown>>(cursor: string | undefined): T | undefined {
  if (!cursor) return undefined;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as T;
    throw new Error('not an object');
  } catch {
    throw new ValidationError('Invalid pagination cursor.');
  }
}