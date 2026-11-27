import type { AppConfig } from './env';

function cleanEnvSecret(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  let cleaned = raw.trim();
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"') && cleaned.length >= 2) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'") && cleaned.length >= 2)
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  return cleaned || undefined;
}

export interface AwsSdkClientOptions {
  region: string;
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string;
  };
}

/**
 * Builds clean AWS SDK v3 client configuration.
 * - Trims whitespace and accidental surrounding quotes from env secrets.
 * - Ignores stale AWS_SESSION_TOKEN when using long-term AKIA IAM user keys.
 * - Falls back to AWS default credential provider chain (IAM Role / Lambda / ECS)
 *   when static env keys are not set.
 */
export function buildAwsSdkOptions(
  config: AppConfig,
  env: NodeJS.ProcessEnv = process.env,
): AwsSdkClientOptions {
  const region = config.awsRegion.trim() || 'ap-south-1';
  const accessKeyId = cleanEnvSecret(env.AWS_ACCESS_KEY_ID);
  const secretAccessKey = cleanEnvSecret(env.AWS_SECRET_ACCESS_KEY);
  const rawSessionToken = cleanEnvSecret(env.AWS_SESSION_TOKEN);

  if (accessKeyId && secretAccessKey) {
    // Long-term IAM user keys start with AKIA and must never send a session token.
    const useSessionToken = rawSessionToken && !accessKeyId.startsWith('AKIA');
    return {
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
        ...(useSessionToken ? { sessionToken: rawSessionToken } : {}),
      },
    };
  }

  return { region };
}
