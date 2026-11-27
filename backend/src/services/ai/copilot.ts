import { GoogleGenAI, ThinkingLevel, type Content } from '@google/genai';
import { containsDosageInstruction } from './bedrock';

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface CopilotTurnInput {
  message: string;
  history?: Array<{ sender: 'user' | 'assistant'; text: string }>;
  mode?: 'grounded' | 'fast';
  farmContext?: {
    farmerName?: string;
    location?: string;
    crops?: string[];
    plotsCount?: number;
    openCasesCount?: number;
    criticalStorageCount?: number;
    activeAlertsCount?: number;
  };
}

export interface CopilotTurnResult {
  reply: string;
  modelUsed: string;
  mode: 'grounded' | 'fast';
  groundingSources: GroundingSource[];
  searchQueries: string[];
  safetyFiltered: boolean;
  disclaimer: string;
  timestamp: string;
}

export interface LiveIntelligenceResult {
  summary: string;
  mandiUpdates: Array<{ crop: string; priceRange: string; trend: string }>;
  weatherBrief: string;
  pestAlert: string;
  sources: string[];
  groundingSources: GroundingSource[];
  searchQueries: string[];
  modelUsed: string;
  generatedAt: string;
}

const COPILOT_DISCLAIMER =
  'AI advisory triage only — verify field, storage, and market decisions with local agronomy experts and official mandi/government sources.';

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('Gemini API key is not configured on the server.');
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

function extractGrounding(response: unknown): {
  groundingSources: GroundingSource[];
  searchQueries: string[];
} {
  const candidate = (
    response as {
      candidates?: Array<{
        groundingMetadata?: {
          webSearchQueries?: string[];
          groundingChunks?: Array<{ web?: { uri?: string; title?: string } }>;
        };
      }>;
    }
  )?.candidates?.[0];

  const meta = candidate?.groundingMetadata;
  const seen = new Set<string>();
  const groundingSources: GroundingSource[] = [];

  for (const chunk of meta?.groundingChunks ?? []) {
    const uri = chunk.web?.uri?.trim();
    if (!uri || seen.has(uri)) continue;
    seen.add(uri);
    groundingSources.push({
      title: chunk.web?.title?.trim() || uri,
      uri,
    });
  }

  const searchQueries = (meta?.webSearchQueries ?? []).filter(
    (q): q is string => typeof q === 'string' && q.trim().length > 0,
  );

  return { groundingSources, searchQueries };
}

export async function runLiveIntelligenceBrief(region = 'Nashik, Maharashtra'): Promise<LiveIntelligenceResult> {
  const ai = getClient();
  const modelUsed = 'gemini-4-hydrogen';

  const response = await ai.models.generateContent({
    model: modelUsed,
    contents: `Provide a current, practical agricultural market and weather intelligence brief for farmers in ${region}, India covering Tomato, Onion, Wheat, and Grapes mandi price ranges, weather forecast, and crop pest/disease alerts.`,
    config: {
      systemInstruction: `You are KRISHI360 AI, an agricultural market and meteorological analyst for Indian farmers.
Use Google Search grounding to retrieve fresh, real-world mandi trends, weather updates, and pest advisories.
Never include chemical or pesticide dosage quantities.
Return ONLY a valid JSON object (no markdown fences) with keys:
- "summary": string (2-3 sentences executive overview)
- "mandiUpdates": array of { "crop": string, "priceRange": string, "trend": string } (4 crops: Tomato, Onion, Wheat, Grapes)
- "weatherBrief": string (concise 1-2 sentence local weather forecast)
- "pestAlert": string (concise 1-2 sentence preventive scouting advisory, no chemical dosages)
- "sources": array of short source label strings`,
      tools: [{ googleSearch: {} }],
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    },
  });

  const { groundingSources, searchQueries } = extractGrounding(response);
  const raw = (response.text ?? '').trim();

  let parsed: Partial<LiveIntelligenceResult> = {};
  try {
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    const match = cleaned.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(match ? match[0] : cleaned) as Partial<LiveIntelligenceResult>;
  } catch {
    parsed = {
      summary: raw || 'Live grounded agricultural briefing retrieved.',
      mandiUpdates: [],
      weatherBrief: 'Check local IMD district bulletin before irrigation or spraying.',
      pestAlert: 'Continue routine leaf-underside scouting across active plots.',
      sources: [],
    };
  }

  const summary =
    typeof parsed.summary === 'string' && parsed.summary.trim()
      ? parsed.summary.trim()
      : 'Live grounded agricultural briefing retrieved.';
  const weatherBrief =
    typeof parsed.weatherBrief === 'string' && parsed.weatherBrief.trim()
      ? parsed.weatherBrief.trim()
      : 'Review district weather conditions before scheduling irrigation.';
  let pestAlert =
    typeof parsed.pestAlert === 'string' && parsed.pestAlert.trim()
      ? parsed.pestAlert.trim()
      : 'Inspect crop canopies and leaf undersides regularly for early stress signs.';

  if (containsDosageInstruction(pestAlert)) {
    pestAlert = 'Preventive crop scouting recommended; consult a local agronomist for any treatment decisions.';
  }

  const mandiUpdates = Array.isArray(parsed.mandiUpdates)
    ? parsed.mandiUpdates
        .filter(
          (item): item is { crop: string; priceRange: string; trend: string } =>
            Boolean(item && typeof item.crop === 'string' && typeof item.priceRange === 'string'),
        )
        .slice(0, 6)
    : [];

  const textSources = Array.isArray(parsed.sources)
    ? parsed.sources.filter((s): s is string => typeof s === 'string' && s.trim().length > 0).slice(0, 8)
    : [];

  return {
    summary,
    mandiUpdates,
    weatherBrief,
    pestAlert,
    sources: textSources.length > 0 ? textSources : groundingSources.map((g) => g.title).slice(0, 6),
    groundingSources,
    searchQueries,
    modelUsed,
    generatedAt: new Date().toISOString(),
  };
}

export async function runKrishiCopilotChat(input: CopilotTurnInput): Promise<CopilotTurnResult> {
  const ai = getClient();
  const mode = input.mode === 'fast' ? 'fast' : 'grounded';
  const modelUsed = mode === 'fast' ? 'gemini-3.1-flash-lite' : 'gemini-4-hydrogen';

  const ctx = input.farmContext ?? {};
  const contextLines = [
    ctx.farmerName ? `Farmer: ${ctx.farmerName}` : '',
    ctx.location ? `Location: ${ctx.location}` : '',
    ctx.crops?.length ? `Active crops: ${ctx.crops.slice(0, 10).join(', ')}` : '',
    typeof ctx.plotsCount === 'number' ? `Registered plots: ${ctx.plotsCount}` : '',
    typeof ctx.openCasesCount === 'number' ? `Open CropDoctor cases: ${ctx.openCasesCount}` : '',
    typeof ctx.criticalStorageCount === 'number' ? `Critical storage batches: ${ctx.criticalStorageCount}` : '',
    typeof ctx.activeAlertsCount === 'number' ? `Active mandi alerts: ${ctx.activeAlertsCount}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const systemInstruction = `You are KRISHI360 AI Copilot, a unified agricultural intelligence assistant for Indian farmers across 5 platform modules:
1. CropDoctor AI (plant health triage & expert review escalation)
2. MandiSmart (mandi price comparison, transport net calculation, market trends)
3. JalSense (soil moisture tracking & irrigation scheduling)
4. GrainGuard (storage temperature/humidity threshold monitoring)
5. SchemeSaathi (government agricultural schemes & eligibility checklists)

Strict Safety & Accuracy Controls:
- NEVER present crop health advice as a confirmed clinical diagnosis; note uncertainty and recommend confirming with a qualified local agronomist.
- NEVER provide chemical, pesticide, fungicide, insecticide, or herbicide dosage instructions (no ml, grams, kg, litres, tanks, pumps per acre/hectare). Advise consulting a qualified local expert for prescriptions.
- Cite timestamps/recency or uncertainty when quoting live mandi prices, weather, or scheme terms.
- Be practical, concise, well-structured, and tailored to the farmer's active farm context below.
${contextLines ? `\nFarmer Workspace Context:\n${contextLines}` : ''}`;

  const historyContents: Content[] = (input.history ?? [])
    .slice(-16)
    .filter((turn) => turn.text && turn.text.trim().length > 0)
    .map((turn) => ({
      role: turn.sender === 'assistant' ? 'model' : 'user',
      parts: [{ text: turn.text.trim().slice(0, 3000) }],
    }));

  const contents: Content[] = [
    ...historyContents,
    { role: 'user', parts: [{ text: input.message.trim().slice(0, 3000) }] },
  ];

  const response = await ai.models.generateContent({
    model: modelUsed,
    contents,
    config:
      mode === 'grounded'
        ? {
            systemInstruction,
            tools: [{ googleSearch: {} }],
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          }
        : {
            systemInstruction,
          },
  });

  const { groundingSources, searchQueries } = extractGrounding(response);
  let reply = (response.text ?? '').trim();

  if (!reply) {
    reply = 'I could not generate a response right now. Please rephrase your question or try again.';
  }

  let safetyFiltered = false;
  if (containsDosageInstruction(reply)) {
    safetyFiltered = true;
    reply =
      'For field safety, KRISHI360 AI cannot recommend pesticide or chemical dosages. Please submit a CropDoctor AI case with clear photos so a qualified local agronomist can advise on safe treatment options, and inspect drainage, airflow, and affected plant parts in the meantime.';
  }

  return {
    reply,
    modelUsed,
    mode,
    groundingSources,
    searchQueries,
    safetyFiltered,
    disclaimer: COPILOT_DISCLAIMER,
    timestamp: new Date().toISOString(),
  };
}
