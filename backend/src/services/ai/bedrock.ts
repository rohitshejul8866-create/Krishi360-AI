import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { z } from 'zod';
import { AI_DISCLAIMER, type AiAnalysis } from '../../models/cropCase';
import { ServiceUnavailableError } from '../../utils/errors';
import { nowIso } from '../../utils/ids';
import type { AiAnalysisService, AnalysisInput } from './types';

/** Strict schema for the model's JSON output. Anything else is rejected. */
const modelOutputSchema = z.object({
  condition: z.string().min(1).max(200),
  confidence: z.number().min(0).max(100),
  uncertainty: z.string().min(1).max(1000),
  alternatives: z.array(z.object({ name: z.string().min(1).max(120), confidence: z.number().min(0).max(100) })).max(5),
  observedSymptoms: z.array(z.string().min(1).max(200)).max(12),
  explanation: z.string().min(1).max(2000),
  nextSteps: z.array(z.string().min(1).max(300)).max(8),
  recommendExpert: z.boolean(),
});

const SYSTEM_PROMPT = `You are an agricultural plant-health assistant for Indian farmers.
Rules you MUST follow:
1. You are NOT a confirmed diagnosis. Express uncertainty explicitly.
2. NEVER provide pesticide, fungicide or chemical dosage instructions (no quantities per acre, hectare, litre, tank or pump). Treatment decisions require a human expert.
3. Recommend consulting a qualified local expert whenever confidence is not very high.
4. Respond with ONLY a JSON object, no markdown fences, matching exactly:
{"condition": string, "confidence": number 0-100, "uncertainty": string, "alternatives": [{"name": string, "confidence": number}], "observedSymptoms": string[], "explanation": string, "nextSteps": string[], "recommendExpert": boolean}
5. nextSteps must be observation and expert-consultation actions only.`;

/** Defence-in-depth: reject dosage-like content even if the model ignores instructions. */
const DOSAGE_PATTERN =
  /\d+(\.\d+)?\s*(ml|millilitre|g|gram|kg|l|litre|liter|cc)\b[^.]{0,60}\b(per|\/|each)\s*(acre|hectare|ha|litre|liter|l|tank|pump|spray)/i;

export function containsDosageInstruction(text: string): boolean {
  return DOSAGE_PATTERN.test(text);
}

const SAFE_NEXT_STEPS = [
  'Photograph affected and healthy plant parts together in daylight.',
  'Record recent weather and irrigation details.',
  'Consult a qualified local expert before any treatment.',
];

function extractJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(trimmed);
}

export interface BedrockDeps {
  bedrock: BedrockRuntimeClient;
  s3: S3Client;
  bucket: string;
  modelId: string;
}

export class BedrockAnalysisService implements AiAnalysisService {
  readonly provider = 'bedrock' as const;
  readonly simulated = false;

  constructor(private deps: BedrockDeps) {}

  private async fetchImage(imageKey: string): Promise<{ format: 'jpeg' | 'png' | 'webp'; bytes: Uint8Array }> {
    const res = await this.deps.s3.send(new GetObjectCommand({ Bucket: this.deps.bucket, Key: imageKey }));
    const bytes = await res.Body?.transformToByteArray();
    if (!bytes) throw new ServiceUnavailableError('AI_IMAGE_UNAVAILABLE', 'The case image could not be read for analysis.');
    const ext = imageKey.split('.').pop()?.toLowerCase();
    const format = ext === 'png' ? 'png' : ext === 'webp' ? 'webp' : 'jpeg';
    return { format, bytes };
  }

  async analyze(input: AnalysisInput): Promise<AiAnalysis> {
    const userText = [
      `Crop: ${input.crop}`,
      `Plant part: ${input.plantPart}`,
      `Location: ${input.location}`,
      `Reported symptoms: ${input.symptoms}`,
      input.imageKey && this.deps.bucket
        ? 'An image of the affected plant is attached.'
        : 'No image was provided; rely on the reported symptoms only.',
    ].join('\n');

    const content: Array<Record<string, unknown>> = [{ text: userText }];
    if (input.imageKey && this.deps.bucket) {
      const image = await this.fetchImage(input.imageKey);
      content.push({ image: { format: image.format, source: { bytes: image.bytes } } });
    }

    let res;
    try {
      res = await this.deps.bedrock.send(
        new ConverseCommand({
          modelId: this.deps.modelId,
          system: [{ text: SYSTEM_PROMPT }],
          messages: [{ role: 'user', content: content as never }],
          inferenceConfig: { maxTokens: 1500, temperature: 0.2 },
        }),
      );
    } catch (err) {
      // Safe message; details stay in logs. AccessDenied usually means the
      // account has not been granted model access in this region.
      throw new ServiceUnavailableError(
        'AIInvocationFailed',
        'The AI model could not be invoked. Verify Bedrock model access, region and IAM permissions.',
      );
    }

    const block = res.output?.message?.content?.find((c) => 'text' in c);
    const text = block && 'text' in block ? block.text : undefined;
    if (!text) throw new ServiceUnavailableError('AI_EMPTY_RESPONSE', 'The AI model returned an empty response.');

    let parsed: z.infer<typeof modelOutputSchema>;
    try {
      const result = modelOutputSchema.safeParse(extractJson(text));
      if (!result.success) throw new Error('schema mismatch');
      parsed = result.data;
    } catch {
      throw new ServiceUnavailableError('AI_INVALID_OUTPUT', 'The AI model output failed validation and was discarded.');
    }

    const dosageDetected =
      containsDosageInstruction(parsed.explanation) || parsed.nextSteps.some(containsDosageInstruction);
    const nextSteps = dosageDetected ? SAFE_NEXT_STEPS : parsed.nextSteps;
    const explanation = dosageDetected
      ? 'The model response contained treatment-quantity content and was sanitised. Consult a qualified expert for treatment decisions.'
      : parsed.explanation;

    return {
      provider: this.provider,
      modelId: this.deps.modelId,
      condition: parsed.condition,
      confidence: parsed.confidence,
      uncertainty: parsed.uncertainty,
      alternatives: parsed.alternatives,
      observedSymptoms: parsed.observedSymptoms,
      explanation,
      nextSteps,
      recommendExpert: true, // always require expert confirmation in this product
      verified: false,
      simulated: false,
      disclaimer: AI_DISCLAIMER,
      analyzedAt: nowIso(),
    };
  }
}