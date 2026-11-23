/**
 * Centralised environment configuration.
 *
 * Safety rules:
 * - Dev-only modes (AUTH_MODE=dev, DATA_BACKEND=memory, AI_PROVIDER=heuristic)
 *   are refused when running inside AWS Lambda.
 * - Bedrock is never called unless AI_PROVIDER=bedrock AND a model id and
 *   region are configured.
 * - No secrets are read from code; everything comes from the environment.
 */

export type AuthMode = 'dev' | 'cognito';
export type DataBackend = 'memory' | 'dynamodb';
export type AiProvider = 'disabled' | 'heuristic' | 'bedrock';

export interface AppConfig {
  nodeEnv: string;
  isLambda: boolean;
  authMode: AuthMode;
  dataBackend: DataBackend;
  awsRegion: string;
  tableName: string;
  dynamoEndpoint?: string;
  awsCredentialsConfigured: boolean;
  uploadBucketName: string;
  allowedOrigins: string[];
  maxUploadBytes: number;
  uploadUrlExpirySeconds: number;
  allowedImageTypes: ReadonlyArray<string>;
  aiProvider: AiProvider;
  bedrockModelId: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  port: number;
}

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

function oneOf<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T, name: string): T {
  if (value === undefined || value === '') return fallback;
  if ((allowed as readonly string[]).includes(value)) return value as T;
  throw new Error(`Invalid ${name}: "${value}". Allowed: ${allowed.join(', ')}`);
}

function positiveInt(value: string | undefined, fallback: number, name: string): number {
  if (value === undefined || value === '') return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new Error(`Invalid ${name}: must be a positive integer`);
  return n;
}

function optionalHttpUrl(value: string | undefined, name: string): string | undefined {
  if (!value || !value.trim()) return undefined;
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    throw new Error(`Invalid ${name}: must be a valid URL.`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Invalid ${name}: must use http or https protocol.`);
  }
  return parsed.toString().replace(/\/+$/, '');
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const isLambda = Boolean(env.AWS_LAMBDA_FUNCTION_NAME);
  const nodeEnv = env.NODE_ENV ?? (isLambda ? 'production' : 'local');

  const authMode = oneOf(env.AUTH_MODE, ['dev', 'cognito'] as const, isLambda ? 'cognito' : 'dev', 'AUTH_MODE');
  const dataBackend = oneOf(env.DATA_BACKEND, ['memory', 'dynamodb'] as const, isLambda ? 'dynamodb' : 'memory', 'DATA_BACKEND');
  const aiProvider = oneOf(env.AI_PROVIDER, ['disabled', 'heuristic', 'bedrock'] as const, 'disabled', 'AI_PROVIDER');

  // Dev-only escape hatches must never be usable in a deployed Lambda.
  if (isLambda && (authMode === 'dev' || dataBackend === 'memory' || aiProvider === 'heuristic')) {
    throw new Error('Refusing to start: dev-only AUTH_MODE/DATA_BACKEND/AI_PROVIDER cannot be used inside AWS Lambda.');
  }

  const awsRegion = env.AWS_REGION || 'ap-south-1';
  const dynamoEndpoint = optionalHttpUrl(env.DYNAMODB_ENDPOINT, 'DYNAMODB_ENDPOINT');
  const awsCredentialsConfigured =
    isLambda ||
    Boolean(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY) ||
    Boolean(env.AWS_WEB_IDENTITY_TOKEN_FILE) ||
    Boolean(dynamoEndpoint);

  const bedrockModelId = env.BEDROCK_MODEL_ID ?? '';
  if (aiProvider === 'bedrock' && (!bedrockModelId || !awsRegion)) {
    throw new Error('AI_PROVIDER=bedrock requires BEDROCK_MODEL_ID and AWS_REGION to be configured.');
  }

  const allowedOrigins = (env.ALLOWED_ORIGINS ?? 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  if (isLambda && allowedOrigins.includes('*')) {
    throw new Error('Wildcard CORS origin is not allowed in deployed environments.');
  }

  return {
    nodeEnv,
    isLambda,
    authMode,
    dataBackend,
    awsRegion,
    tableName: env.DYNAMODB_TABLE_NAME || 'krishi360-dev',
    dynamoEndpoint,
    awsCredentialsConfigured,
    uploadBucketName: env.UPLOAD_BUCKET_NAME ?? '',
    allowedOrigins,
    maxUploadBytes: positiveInt(env.MAX_UPLOAD_BYTES, 5 * 1024 * 1024, 'MAX_UPLOAD_BYTES'),
    uploadUrlExpirySeconds: positiveInt(env.UPLOAD_URL_EXPIRY_SECONDS, 300, 'UPLOAD_URL_EXPIRY_SECONDS'),
    allowedImageTypes: ALLOWED_IMAGE_TYPES,
    aiProvider,
    bedrockModelId,
    logLevel: oneOf(env.LOG_LEVEL, ['debug', 'info', 'warn', 'error'] as const, 'info', 'LOG_LEVEL'),
    port: positiveInt(env.PORT, 4000, 'PORT'),
  };
}