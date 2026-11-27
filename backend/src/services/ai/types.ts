import type { AiAnalysis } from '../../models/cropCase';

export interface AnalysisInput {
  crop: string;
  plantPart: string;
  location: string;
  symptoms: string;
  /** Private S3 object key; the service fetches bytes server-side when needed. */
  imageKey?: string;
  /** Inline base64-encoded raster image uploaded via the CropDoctor API. */
  imageData?: {
    mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
    base64: string;
  };
}

/**
 * AI boundary. Implementations must:
 * - never mark output as verified,
 * - always include uncertainty + disclaimer,
 * - never emit pesticide dosage instructions.
 */
export interface AiAnalysisService {
  readonly provider: 'gemini' | 'bedrock' | 'heuristic';
  readonly simulated: boolean;
  analyze(input: AnalysisInput): Promise<AiAnalysis>;
}

export const AI_ANALYSIS_DISABLED_MESSAGE =
  'AI analysis is not configured. Configure GEMINI_API_KEY or AI_PROVIDER before using this endpoint.';