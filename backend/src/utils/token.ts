import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { Role } from '../middleware/auth';

const RUNTIME_SIGNING_SECRET = randomBytes(32);

function getSigningKey(): Buffer {
  const configured = process.env.SESSION_SECRET;
  if (configured && configured.length >= 16) {
    return createHash('sha256').update(configured).digest();
  }
  return RUNTIME_SIGNING_SECRET;
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string | undefined): boolean {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, expectedHex] = storedHash.split(':');
  if (!salt || !expectedHex) return false;
  try {
    const derived = scryptSync(password, salt, 64);
    const expected = Buffer.from(expectedHex, 'hex');
    if (derived.length !== expected.length) return false;
    return timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

export function constantTimeEqualsSecret(input: string, secret: string): boolean {
  const a = createHash('sha256').update(input).digest();
  const b = createHash('sha256').update(secret).digest();
  return timingSafeEqual(a, b);
}

export interface SessionTokenClaims {
  sub: string;
  role: Role;
  name: string;
  email: string;
  exp: number;
}

export function signSessionToken(
  payload: Omit<SessionTokenClaims, 'exp'>,
  ttlSeconds = 12 * 60 * 60,
): string {
  const claims: SessionTokenClaims = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const encoded = Buffer.from(JSON.stringify(claims), 'utf8').toString('base64url');
  const sig = createHmac('sha256', getSigningKey()).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifySessionToken(token: string): SessionTokenClaims | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  if (!encoded || !sig) return null;
  const expectedSig = createHmac('sha256', getSigningKey()).update(encoded).digest('base64url');
  const sigBuf = Buffer.from(sig, 'utf8');
  const expBuf = Buffer.from(expectedSig, 'utf8');
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionTokenClaims;
    if (!parsed || typeof parsed.sub !== 'string' || typeof parsed.exp !== 'number') return null;
    if (parsed.exp <= Math.floor(Date.now() / 1000)) return null;
    if (parsed.role !== 'farmer' && parsed.role !== 'expert' && parsed.role !== 'admin') return null;
    return parsed;
  } catch {
    return null;
  }
}
