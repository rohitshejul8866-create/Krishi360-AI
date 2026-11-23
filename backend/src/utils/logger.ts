/**
 * Minimal structured JSON logger for CloudWatch.
 * - Never logs request bodies, tokens, authorization headers or secrets.
 * - Redacts sensitive keys recursively and masks email addresses.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const SENSITIVE_KEY = /authorization|token|password|secret|credential|api[-_]?key|cookie/i;
const EMAIL_KEY = /email/i;

export interface Logger {
  debug(msg: string, fields?: Record<string, unknown>): void;
  info(msg: string, fields?: Record<string, unknown>): void;
  warn(msg: string, fields?: Record<string, unknown>): void;
  error(msg: string, fields?: Record<string, unknown>): void;
  child(fields: Record<string, unknown>): Logger;
}

function maskEmail(value: string): string {
  const [name, domain] = value.split('@');
  if (!domain || !name) return '[redacted]';
  return `${name.slice(0, 1)}***@${domain}`;
}

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[truncated]';
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY.test(k)) out[k] = '[redacted]';
      else if (EMAIL_KEY.test(k) && typeof v === 'string') out[k] = maskEmail(v);
      else out[k] = redact(v, depth + 1);
    }
    return out;
  }
  return value;
}

export function createLogger(level: LogLevel, base: Record<string, unknown> = {}): Logger {
  const emit = (lvl: LogLevel, msg: string, fields?: Record<string, unknown>) => {
    if (LEVELS[lvl] < LEVELS[level]) return;
    const line = {
      level: lvl,
      msg,
      time: new Date().toISOString(),
      ...(redact(base) as Record<string, unknown>),
      ...(fields ? (redact(fields) as Record<string, unknown>) : {}),
    };
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(line));
  };
  return {
    debug: (m, f) => emit('debug', m, f),
    info: (m, f) => emit('info', m, f),
    warn: (m, f) => emit('warn', m, f),
    error: (m, f) => emit('error', m, f),
    child: (fields) => createLogger(level, { ...base, ...fields }),
  };
}