import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';
import { S3Client } from '@aws-sdk/client-s3';
import type { AppConfig } from '../../config/env';
import { ServiceUnavailableError } from '../../utils/errors';
import { BedrockAnalysisService } from './bedrock';
import { GeminiAnalysisService } from './gemini';
import { HeuristicAnalysisService } from './heuristic';
import { AI_ANALYSIS_DISABLED_MESSAGE, type AiAnalysisService, type AnalysisInput } from './types';

class DisabledAnalysisService implements AiAnalysisService {
  readonly provider = 'heuristic' as const;
  readonly simulated = true;
  async analyze(_input: AnalysisInput): Promise<never> {
    throw new ServiceUnavailableError('AI_NOT_CONFIGURED', AI_ANALYSIS_DISABLED_MESSAGE);
  }
}

/**
 * Selects the configured CropDoctor AI provider (Gemini, Bedrock, or local heuristic).
 * Defaults to failing closed with 503 AI_NOT_CONFIGURED when disabled.
 */
export function createAiService(config: AppConfig, s3?: S3Client): AiAnalysisService {
  switch (config.aiProvider) {
    case 'gemini':
      return new GeminiAnalysisService(config.geminiModelId);
    case 'bedrock': {
      const bearerToken =
        process.env.AWS_BEARER_TOKEN_BEDROCK?.trim() || process.env.AWS_BEARER_TOKEN?.trim();
      return new BedrockAnalysisService({
        bedrock: new BedrockRuntimeClient({
          region: config.awsRegion,
          ...(bearerToken
            ? {
                token: async () => ({ token: bearerToken }),
                authSchemePreference: ['httpBearerAuth'],
              }
            : {}),
        }),
        s3: s3 ?? new S3Client({ region: config.awsRegion }),
        bucket: config.uploadBucketName,
        modelId: config.bedrockModelId,
      });
    }
    case 'heuristic':
      return new HeuristicAnalysisService();
    default:
      return new DisabledAnalysisService();
  }
}