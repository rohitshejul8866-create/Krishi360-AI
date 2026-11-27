import { GoogleGenAI, ThinkingLevel, Type, type GenerateContentResponse } from '@google/genai';
import { z } from 'zod';
import { AI_DISCLAIMER, type AiAnalysis } from '../../models/cropCase';
import { ServiceUnavailableError } from '../../utils/errors';
import { nowIso } from '../../utils/ids';
import { containsDosageInstruction } from './bedrock';
import type { AiAnalysisService, AnalysisInput } from './types';

const modelOutputSchema = z.object({
  condition: z.string().trim().min(1).max(200),
  confidence: z.number().min(0).max(100),
  uncertainty: z.string().trim().min(1).max(1000),
  alternatives: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        confidence: z.number().min(0).max(100),
      }),
    )
    .max(5),
  observedSymptoms: z.array(z.string().trim().min(1).max(200)).max(12),
  explanation: z.string().trim().min(1).max(2500),
  nextSteps: z.array(z.string().trim().min(1).max(300)).min(1).max(8),
  recommendExpert: z.boolean(),
});

const SYSTEM_INSTRUCTION = `You are KRISHI360 CropDoctor AI, an agricultural plant-health triage assistant for farmers in India.
Strict rules you MUST follow:
1. Never present your response as a confirmed clinical diagnosis. Explicitly state uncertainty and visual limitations in the "uncertainty" field.
2. NEVER output chemical, pesticide, fungicide, insecticide, or herbicide dosage instructions (no ml, grams, kg, litres, pumps, tanks, or amounts per acre/hectare). Treatment prescriptions require a qualified local agronomist.
3. Keep "nextSteps" strictly observational, preventive, and diagnostic (e.g., inspecting leaf undersides, checking drainage/irrigation, taking daylight close-ups, isolating affected samples, consulting a qualified local expert).
4. Base your analysis carefully on the attached plant image (if provided) together with the crop, plant part, location, and farmer-reported symptoms. If the image is unclear or doesn't show a plant clearly, reflect that honestly with lower confidence and clear guidance in "uncertainty" and "explanation".
5. Set "recommendExpert" to true whenever expert confirmation is advisable (almost always true for field decisions).
6. Confidence values must be realistic integers between 0 and 100.`;

const SAFE_NEXT_STEPS = [
  'Photograph affected and healthy plant parts together in clear daylight.',
  'Inspect the leaf undersides, stems, and nearby plants for spread.',
  'Record recent rainfall, humidity, and irrigation timing.',
  'Consult a qualified local agronomist before applying any treatment.',
];

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    condition: {
      type: Type.STRING,
      description: 'Most likely candidate plant condition or stress pattern (e.g. "Possible early blight").',
    },
    confidence: {
      type: Type.NUMBER,
      description: 'Estimated confidence score from 0 to 100.',
    },
    uncertainty: {
      type: Type.STRING,
      description: 'Plain-language statement of diagnostic uncertainty and image/symptom limitations.',
    },
    alternatives: {
      type: Type.ARRAY,
      description: 'Up to 3 plausible differential diagnoses or alternative causes.',
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          confidence: { type: Type.NUMBER },
        },
        required: ['name', 'confidence'],
      },
    },
    observedSymptoms: {
      type: Type.ARRAY,
      description: 'Key visual or reported symptoms observed from the image and description.',
      items: { type: Type.STRING },
    },
    explanation: {
      type: Type.STRING,
      description: 'Clear, helpful plain-language explanation for the farmer (no chemical dosages).',
    },
    nextSteps: {
      type: Type.ARRAY,
      description: '3 to 5 safe observational, cultural, and expert-consultation next steps (no chemical dosages).',
      items: { type: Type.STRING },
    },
    recommendExpert: {
      type: Type.BOOLEAN,
      description: 'Whether a human agronomist review is recommended.',
    },
  },
  required: [
    'condition',
    'confidence',
    'uncertainty',
    'alternatives',
    'observedSymptoms',
    'explanation',
    'nextSteps',
    'recommendExpert',
  ],
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getHttpStatus(err: unknown): number | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const candidate = err as { status?: unknown; code?: unknown };
  if (typeof candidate.status === 'number') return candidate.status;
  if (typeof candidate.code === 'number') return candidate.code;
  return undefined;
}

function isRetryableGeminiError(err: unknown): boolean {
  const status = getHttpStatus(err);
  if (status && [408, 429, 500, 502, 503, 504].includes(status)) return true;
  const msg = err instanceof Error ? err.message.toLowerCase() : '';
  return msg.includes('fetch') || msg.includes('timeout') || msg.includes('network') || msg.includes('econnreset');
}

function mapGeminiError(err: unknown): ServiceUnavailableError {
  const status = getHttpStatus(err);
  const rawMessage = err instanceof Error ? err.message : String(err);
  const upper = rawMessage.toUpperCase();

  if (status === 400 && (upper.includes('API_KEY_INVALID') || upper.includes('API KEY'))) {
    return new ServiceUnavailableError(
      'GEMINI_API_KEY_INVALID',
      'Gemini API key is invalid. Please check GEMINI_API_KEY in Settings > Secrets.',
    );
  }
  if (status === 403 || upper.includes('PERMISSION_DENIED')) {
    return new ServiceUnavailableError(
      'GEMINI_PERMISSION_DENIED',
      'Gemini API access was denied. Please verify your API key in Settings > Secrets.',
    );
  }
  if (status === 429 || upper.includes('RESOURCE_EXHAUSTED')) {
    return new ServiceUnavailableError(
      'GEMINI_QUOTA_EXCEEDED',
      'Gemini API quota limit reached. Please retry shortly or check your API billing quota in Settings > Secrets.',
    );
  }
  if (status === 404 || upper.includes('NOT_FOUND')) {
    return new ServiceUnavailableError(
      'GEMINI_MODEL_NOT_FOUND',
      'Configured Gemini model is unavailable. Verify the model configuration.',
    );
  }
  return new ServiceUnavailableError(
    'GEMINI_INVOCATION_FAILED',
    'Gemini crop analysis could not complete right now. Please try again in a moment.',
  );
}

export class GeminiAnalysisService implements AiAnalysisService {
  readonly provider = 'gemini' as const;
  readonly simulated = false;

  constructor(private readonly modelId: string = 'gemini-4-hydrogen') {}

  private createClient(): GoogleGenAI {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      throw new ServiceUnavailableError(
        'AI_NOT_CONFIGURED',
        'Gemini API key is not configured on the server. Set GEMINI_API_KEY in Settings > Secrets.',
      );
    }
    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }

  async analyze(input: AnalysisInput): Promise<AiAnalysis> {
    const ai = this.createClient();

    const promptLines = [
      `Crop: ${input.crop}`,
      `Affected plant part: ${input.plantPart}`,
      `Farm location: ${input.location || 'India'}`,
      `Reported symptoms: ${input.symptoms.trim() || 'Not specified — analyze from visual cues in the image.'}`,
      input.imageData
        ? 'An image of the crop sample is attached. Inspect visible lesions, discoloration, pests, or structural stress carefully.'
        : 'No image bytes were attached; base your differential analysis on the crop, plant part, location, and reported symptoms.',
    ];

    const contents = input.imageData
      ? {
          parts: [
            {
              inlineData: {
                mimeType: input.imageData.mimeType,
                data: input.imageData.base64,
              },
            },
            { text: promptLines.join('\n') },
          ],
        }
      : promptLines.join('\n');

    let response: GenerateContentResponse | undefined;
    let lastError: unknown;
    const delays = [300, 900];

    for (let attempt = 0; attempt <= delays.length; attempt++) {
      try {
        response = await ai.models.generateContent({
          model: this.modelId,
          contents,
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            responseMimeType: 'application/json',
            responseSchema: RESPONSE_SCHEMA,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          },
        });
        break;
      } catch (err) {
        lastError = err;
        if (attempt < delays.length && isRetryableGeminiError(err)) {
          await sleep(delays[attempt]);
          continue;
        }
        throw mapGeminiError(err);
      }
    }

    if (!response) {
      throw mapGeminiError(lastError);
    }

    const rawText = (response.text ?? '').trim();
    if (!rawText) {
      throw new ServiceUnavailableError('AI_EMPTY_RESPONSE', 'Gemini returned an empty crop analysis response.');
    }

    let parsed: z.infer<typeof modelOutputSchema>;
    try {
      const cleaned = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
      const result = modelOutputSchema.safeParse(JSON.parse(cleaned));
      if (!result.success) {
        throw new Error('Schema validation failed');
      }
      parsed = result.data;
    } catch {
      throw new ServiceUnavailableError(
        'AI_INVALID_OUTPUT',
        'Gemini returned an unexpected output format. Please try analyzing again.',
      );
    }

    const dosageDetected =
      containsDosageInstruction(parsed.explanation) ||
      parsed.nextSteps.some(containsDosageInstruction) ||
      containsDosageInstruction(parsed.uncertainty);

    const safeNextSteps = parsed.nextSteps.filter((step) => !containsDosageInstruction(step));
    const nextSteps = dosageDetected || safeNextSteps.length === 0 ? SAFE_NEXT_STEPS : safeNextSteps;
    const explanation = dosageDetected
      ? 'Chemical dosage details were omitted for field safety. Consult a qualified local agronomist for treatment decisions.'
      : parsed.explanation;

    const confidence = Math.round(Math.min(100, Math.max(0, parsed.confidence)));

    return {
      provider: this.provider,
      modelId: this.modelId,
      condition: parsed.condition,
      confidence,
      uncertainty: parsed.uncertainty,
      alternatives: parsed.alternatives.map((alt) => ({
        name: alt.name,
        confidence: Math.round(Math.min(100, Math.max(0, alt.confidence))),
      })),
      observedSymptoms: parsed.observedSymptoms,
      explanation,
      nextSteps,
      recommendExpert: true,
      verified: false,
      simulated: false,
      disclaimer: AI_DISCLAIMER,
      analyzedAt: nowIso(),
    };
  }
}
