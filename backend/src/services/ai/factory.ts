import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';
import { S3Client } from '@aws-sdk/client-s3';
import type { AppConfig } from '../../config/env';
import { ServiceUnavailableError } from '../../utils/errors';
import { BedrockAnalysisService } from './bedrock';
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
 * Bedrock is only constructed when explicitly enabled AND a model id and
 * region are configured (loadConfig enforces this). Otherwise the endpoint
 * fails closed with 503 AI_NOT_CONFIGURED.
 */
export function createAiService(config: AppConfig, s3?: S3Client): AiAnalysisService {
  switch (config.aiProvider) {
    case 'bedrock':
      return new BedrockAnalysisService({
        bedrock: new BedrockRuntimeClient({ region: config.awsRegion }),
        s3: s3 ?? new S3Client({ region: config.awsRegion }),
        bucket: config.uploadBucketName,
        modelId: config.bedrockModelId,
      });
    case 'heuristic':
      return new HeuristicAnalysisService();
    default:
      return new DisabledAnalysisService();
  }
}