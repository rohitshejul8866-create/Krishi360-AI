import type { AiAnalysis } from '../../models/cropCase';

export interface AnalysisInput {
  crop: string;
  plantPart: string;
  location: string;
  symptoms: string;
  /** Private S3 object key; the service fetches bytes server-side when needed. */
  imageKey?: string;
}

/**
 * AI boundary. Implementations must:
 * - never mark output as verified,
 * - always include uncertainty + disclaimer,
 * - never emit pesticide dosage instructions.
 */
export interface AiAnalysisService {
  readonly provider: 'bedrock' | 'heuristic';
  readonly simulated: boolean;
  analyze(input: AnalysisInput): Promise<AiAnalysis>;
}

export const AI_ANALYSIS_DISABLED_MESSAGE =
  'AI analysis is not configured. Set AI_PROVIDER and grant Bedrock model access before using this endpoint.';