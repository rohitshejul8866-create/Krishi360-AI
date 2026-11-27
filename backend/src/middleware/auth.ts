import type { APIGatewayProxyEvent } from 'aws-lambda';
import type { AppConfig } from '../config/env';
import { ForbiddenError, UnauthorizedError } from '../utils/errors';
import { verifySessionToken } from '../utils/token';

export type Role = 'farmer' | 'expert' | 'admin';
export const ROLES: readonly Role[] = ['farmer', 'expert', 'admin'];

export interface AuthUser {
  id: string;
  role: Role;
  name?: string;
  email?: string;
  groups: string[];
}

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

function header(event: APIGatewayProxyEvent, name: string): string | undefined {
  const headers = event.headers ?? {};
  const lower = name.toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === lower && typeof v === 'string') return v;
  }
  return undefined;
}

/** Cognito groups claim may arrive as a JSON array string or a real array. */
export function parseGroups(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((g): g is string => typeof g === 'string');
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter((g): g is string => typeof g === 'string');
    } catch {
      /* fall through to comma-separated */
    }
    return raw.split(',').map((g) => g.trim()).filter(Boolean);
  }
  return [];
}

/** Highest-privilege group wins; documented in docs/SECURITY.md. */
export function roleFromGroups(groups: string[]): Role | null {
  if (groups.includes('admin')) return 'admin';
  if (groups.includes('expert')) return 'expert';
  if (groups.includes('farmer')) return 'farmer';
  return null;
}

/**
 * Resolve the calling user.
 *
 * cognito mode: API Gateway's Cognito authorizer has ALREADY verified the JWT
 * signature, expiry, issuer and audience before Lambda runs.
 *
 * session token mode: verifies HMAC-SHA256 signed Authorization Bearer token
 * issued by /api/auth/* on login/registration.
 */
export function resolveUser(event: APIGatewayProxyEvent, config: AppConfig): AuthUser | null {
  if (config.authMode === 'dev' || config.authMode === 'session') {
    const authHeader = header(event, 'authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.slice(7).trim();
    if (!token) return null;
    const claims = verifySessionToken(token);
    if (!claims) throw new UnauthorizedError('Invalid or expired session token.');
    return {
      id: claims.sub,
      role: claims.role,
      name: claims.name,
      email: claims.email,
      groups: [claims.role],
    };
  }

  const claims = (event.requestContext?.authorizer as { claims?: Record<string, unknown> } | undefined)?.claims;
  if (!claims || typeof claims.sub !== 'string' || !claims.sub) return null;
  const groups = parseGroups(claims['cognito:groups']);
  const role = roleFromGroups(groups);
  if (!role) return null; // authenticated but no application role assigned
  return {
    id: claims.sub,
    role,
    name: typeof claims.name === 'string' ? claims.name : undefined,
    email: typeof claims.email === 'string' ? claims.email : undefined,
    groups,
  };
}

export function requireRole(user: AuthUser | null, ...roles: Role[]): AuthUser {
  if (!user) throw new UnauthorizedError();
  if (!roles.includes(user.role)) throw new ForbiddenError();
  return user;
}