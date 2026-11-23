import { randomUUID } from 'node:crypto';

/** Short, URL-safe, collision-resistant ids with a readable prefix. */
export function makeId(prefix: string): string {
  return `${prefix}-${randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** YYYY-MM-DD (UTC) — used for date-partitioned audit keys. */
export function dateKey(iso: string = nowIso()): string {
  return iso.slice(0, 10);
}