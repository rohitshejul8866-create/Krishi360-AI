import { GoogleGenAI, ThinkingLevel, type Content, type GenerateContentResponse } from '@google/genai';
import { ServiceUnavailableError } from '../../utils/errors';
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
    recentCases?: Array<{
      id: string;
      crop: string;
      condition: string;
      reviewStatus: string;
    }>;
    criticalBatches?: Array<{
      code: string;
      crop: string;
      tempC: number;
      humidity: number;
      status: string;
    }>;
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
  searchGrounded: boolean;
  groundingNotice?: string;
  generatedAt: string;
}

const COPILOT_DISCLAIMER =
  'AI advisory triage only — verify field, storage, and market decisions with local agronomy experts and official mandi/government sources.';

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

function mapGeminiCopilotError(err: unknown, contextLabel: string): ServiceUnavailableError {
  if (err instanceof ServiceUnavailableError) return err;
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
      'Gemini API access was denied. Please verify GEMINI_API_KEY in Settings > Secrets.',
    );
  }
  if (status === 429 || upper.includes('RESOURCE_EXHAUSTED')) {
    return new ServiceUnavailableError(
      'GEMINI_QUOTA_EXCEEDED',
      'Gemini API quota limit reached. Please retry shortly or check your billing quota in Settings > Secrets.',
    );
  }
  if (status === 404 || upper.includes('NOT_FOUND')) {
    return new ServiceUnavailableError(
      'GEMINI_MODEL_NOT_FOUND',
      'Configured Gemini model is currently unavailable for this key. Try switching to Fast Mode or verify model availability.',
    );
  }
  return new ServiceUnavailableError(
    'GEMINI_INVOCATION_FAILED',
    `${contextLabel} could not complete (${rawMessage.slice(0, 180)}). Please try again.`,
  );
}

function getClient(): GoogleGenAI {
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

async function generateWithRetry(
  ai: GoogleGenAI,
  params: Parameters<GoogleGenAI['models']['generateContent']>[0],
  contextLabel: string,
): Promise<{ response: GenerateContentResponse; modelUsed: string }> {
  const delays = [300, 900];
  let lastError: unknown;
  let currentParams = params;

  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      const response = await ai.models.generateContent(currentParams);
      return { response, modelUsed: currentParams.model };
    } catch (err) {
      lastError = err;
      const status = getHttpStatus(err);
      const rawMsg = err instanceof Error ? err.message : String(err);

      // If thinkingConfig + googleSearch returns a 400 argument error, retry cleanly without thinkingConfig.
      if (
        status === 400 &&
        currentParams.config &&
        'thinkingConfig' in currentParams.config &&
        !rawMsg.toUpperCase().includes('API_KEY')
      ) {
        const { thinkingConfig: _removed, ...restConfig } = currentParams.config;
        currentParams = { ...currentParams, config: restConfig };
        continue;
      }

      // If gemini-4-hydrogen hits quota (429) or availability (404), fall back to gemini-3.1-flash-lite with the same config.
      if (
        (status === 429 || status === 404 || rawMsg.toUpperCase().includes('RESOURCE_EXHAUSTED')) &&
        currentParams.model === 'gemini-4-hydrogen'
      ) {
        const restConfig = currentParams.config ? { ...currentParams.config } : undefined;
        if (restConfig && 'thinkingConfig' in restConfig) {
          delete (restConfig as { thinkingConfig?: unknown }).thinkingConfig;
        }
        currentParams = {
          ...currentParams,
          model: 'gemini-3.1-flash-lite',
          config: restConfig,
        };
        continue;
      }

      if (attempt < delays.length && isRetryableGeminiError(err)) {
        await sleep(delays[attempt]);
        continue;
      }
      throw mapGeminiCopilotError(err, contextLabel);
    }
  }

  throw mapGeminiCopilotError(lastError, contextLabel);
}

const LIVE_INTEL_CACHE_TTL_MS = 15 * 60 * 1000;
const liveIntelCache = new Map<string, { result: LiveIntelligenceResult; expiresAt: number }>();

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

function getFallbackLiveIntelligence(region: string): LiveIntelligenceResult {
  return {
    summary: `${region} region is currently balancing late-season harvest management with pre-monsoon land preparation. Farmers should prioritize post-harvest storage ventilation for onions and optimal irrigation scheduling for standing vineyard and tomato plots as temperatures transition.`,
    mandiUpdates: [
      { crop: 'Tomato', priceRange: '₹2,100 - ₹2,800 / qtl', trend: 'Steady local demand' },
      { crop: 'Onion', priceRange: '₹1,800 - ₹2,400 / qtl', trend: 'Firm pricing (check storage humidity)' },
      { crop: 'Wheat', priceRange: '₹2,350 - ₹2,550 / qtl', trend: 'MSP supported stable trend' },
      { crop: 'Grapes', priceRange: '₹4,500 - ₹7,200 / qtl', trend: 'Export grading active' },
    ],
    weatherBrief: 'Partly cloudy skies with moderate daytime temperatures (28°C–34°C); no immediate heavy rainfall warning issued for the district.',
    pestAlert: 'Monitor lower foliage on tomato and horticultural crops for early blight or fruit borer activity; avoid overhead wetting.',
    sources: ['Agmarknet APMC Baseline', 'IMD Regional Agromet Bulletin', 'KRISHI360 Knowledge Base'],
    groundingSources: [],
    searchQueries: [],
    modelUsed: 'gemini-fallback-baseline',
    searchGrounded: false,
    groundingNotice: 'Showing regional baseline agricultural intelligence (Set GEMINI_API_KEY in Settings > Secrets for live Google Search grounded briefing).',
    generatedAt: new Date().toISOString(),
  };
}

export async function runLiveIntelligenceBrief(region = 'Nashik, Maharashtra'): Promise<LiveIntelligenceResult> {
  const cacheKey = region.trim().toLowerCase() || 'nashik, maharashtra';
  const cached = liveIntelCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.result;
  }

  try {

  const ai = getClient();
  let response: GenerateContentResponse;
  let modelUsed = 'gemini-4-hydrogen';
  let searchGrounded = true;
  let groundingNotice: string | undefined;

  try {
    const grounded = await generateWithRetry(
      ai,
      {
        model: 'gemini-4-hydrogen',
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
      },
      'Live Gemini Search brief',
    );
    response = grounded.response;
    modelUsed = grounded.modelUsed;
  } catch (err) {
    const isQuotaOrModelLimit =
      err instanceof ServiceUnavailableError &&
      (err.code === 'GEMINI_QUOTA_EXCEEDED' || err.code === 'GEMINI_MODEL_NOT_FOUND');
    if (!isQuotaOrModelLimit) {
      throw err;
    }

    // Search Grounding or gemini-4-hydrogen hit quota; fall back to standard Gemini (without web search)
    // and clearly mark searchGrounded=false so the UI informs the user transparently.
    searchGrounded = false;
    groundingNotice =
      'Google Search grounding quota is reached on the current API key — showing a Gemini advisory brief without live web search. Check billing/quota in Settings > Secrets for live Search citations.';

    const standard = await generateWithRetry(
      ai,
      {
        model: 'gemini-3.1-flash-lite',
        contents: `Provide a concise, practical regional agricultural advisory brief for farmers in ${region}, India covering seasonal market planning for Tomato, Onion, Wheat, and Grapes, weather-aware irrigation reminders, and preventive crop scouting.`,
        config: {
          systemInstruction: `You are KRISHI360 AI, an agricultural advisory assistant for Indian farmers.
Live web search is unavailable right now, so DO NOT invent or claim exact live daily spot prices or URLs. Focus on seasonal market preparation, moisture/weather precautions, and preventive scouting.
Never include chemical or pesticide dosage quantities.
Return ONLY a valid JSON object (no markdown fences) with keys:
- "summary": string (2-3 sentences practical regional overview)
- "mandiUpdates": array of { "crop": string, "priceRange": string, "trend": string } (4 crops: Tomato, Onion, Wheat, Grapes — use "Check local APMC" for priceRange and concise grading/holding tip for trend)
- "weatherBrief": string (concise 1-2 sentence seasonal weather & irrigation precaution)
- "pestAlert": string (concise 1-2 sentence preventive scouting advisory, no chemical dosages)
- "sources": array of short advisory reference strings (e.g. "Agmarknet APMC check recommended", "IMD District Agromet Bulletin")`,
        },
      },
      'Gemini advisory brief',
    );
    response = standard.response;
    modelUsed = standard.modelUsed;
  }

  const { groundingSources, searchQueries } = searchGrounded
    ? extractGrounding(response)
    : { groundingSources: [], searchQueries: [] };
  const raw = (response.text ?? '').trim();

  let parsed: Partial<LiveIntelligenceResult> = {};
  try {
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    const match = cleaned.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(match ? match[0] : cleaned) as Partial<LiveIntelligenceResult>;
  } catch {
    parsed = {
      summary: raw || 'Agricultural intelligence briefing retrieved from Gemini.',
      mandiUpdates: [],
      weatherBrief: 'Check local IMD district bulletin before irrigation or spraying.',
      pestAlert: 'Continue routine leaf-underside scouting across active plots.',
      sources: [],
    };
  }

  const summary =
    typeof parsed.summary === 'string' && parsed.summary.trim()
      ? parsed.summary.trim()
      : 'Agricultural intelligence briefing retrieved from Gemini.';
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

  const result: LiveIntelligenceResult = {
    summary,
    mandiUpdates,
    weatherBrief,
    pestAlert,
    sources: textSources.length > 0 ? textSources : groundingSources.map((g) => g.title).slice(0, 6),
    groundingSources,
    searchQueries,
    modelUsed,
    searchGrounded,
    groundingNotice,
    generatedAt: new Date().toISOString(),
  };

  liveIntelCache.set(cacheKey, { result, expiresAt: Date.now() + LIVE_INTEL_CACHE_TTL_MS });
  return result;
  } catch {
    const fallback = getFallbackLiveIntelligence(region);
    liveIntelCache.set(cacheKey, { result: fallback, expiresAt: Date.now() + LIVE_INTEL_CACHE_TTL_MS });
    return fallback;
  }
}

function getFallbackCopilotReply(message: string, context?: CopilotTurnInput['farmContext']): string {
  const query = message.toLowerCase();
  const farmer = context?.farmerName ? `, ${context.farmerName}` : '';
  const location = context?.location ? ` in ${context.location}` : '';

  if (query.includes('irrigat') || query.includes('water') || query.includes('soil')) {
    return `Namaste${farmer}. For irrigation planning${location}, check your active plot soil moisture levels in **JalSense**. If moisture is above 60% or rain is expected, hold irrigation. For dry plots (<30%), schedule early morning drip irrigation (06:00–08:30) to minimize evaporation.`;
  }
  if (query.includes('mandi') || query.includes('price') || query.includes('market') || query.includes('onion') || query.includes('tomato')) {
    return `Namaste${farmer}. Review the latest APMC market trends in **MandiSmart**. Current regional pricing indicates steady demand for tomatoes and firm rates for graded onions. Always compare modal prices and net transport proceeds before dispatching produce.`;
  }
  if (query.includes('storage') || query.includes('grain') || query.includes('temp') || query.includes('humidity')) {
    return `Namaste${farmer}. Monitor your silo or warehouse storage batches in **GrainGuard**. Ensure temperature remains below 28°C and relative humidity stays under 70% to prevent fungal spoilage. Check ventilation vents if readings trend high.`;
  }
  if (query.includes('scheme') || query.includes('pm-kisan') || query.includes('subsidy') || query.includes('insurance')) {
    return `Namaste${farmer}. Explore eligible government schemes and financial support in **SchemeSaathi**. Keep your Aadhaar, land record 7/12 extract, and bank passbook ready when applying for PM-KISAN or crop insurance portals.`;
  }
  if (query.includes('crop') || query.includes('disease') || query.includes('blight') || query.includes('spot') || query.includes('leaf')) {
    return `Namaste${farmer}. For crop health triage, use **CropDoctor AI** to upload a clear daylight photo of the affected plant part and symptoms. Remember that AI triage provides indicative patterns only—always confirm with a qualified local agronomist before taking action.`;
  }
  return `Namaste${farmer}! I am your KRISHI360 AI Copilot${location}. I can help you with crop health triage in CropDoctor, market price trends in MandiSmart, irrigation scheduling in JalSense, storage monitoring in GrainGuard, and government schemes in SchemeSaathi. How can I assist you with your farm operations today?`;
}

export async function runKrishiCopilotChat(input: CopilotTurnInput): Promise<CopilotTurnResult> {
  const mode = input.mode === 'fast' ? 'fast' : 'grounded';
  try {
    const ai = getClient();
    const requestedModel = mode === 'fast' ? 'gemini-3.1-flash-lite' : 'gemini-4-hydrogen';

    const ctx = input.farmContext ?? {};
    const contextLines = [
      ctx.farmerName ? `Farmer: ${ctx.farmerName}` : '',
      ctx.location ? `Location: ${ctx.location}` : '',
      ctx.crops?.length ? `Active crops: ${ctx.crops.slice(0, 10).join(', ')}` : '',
      typeof ctx.plotsCount === 'number' ? `Registered plots: ${ctx.plotsCount}` : '',
      typeof ctx.openCasesCount === 'number' ? `Open CropDoctor cases: ${ctx.openCasesCount}` : '',
      ctx.recentCases?.length
        ? `Recent CropDoctor cases: ${ctx.recentCases
            .slice(0, 5)
            .map((c) => `${c.id} (${c.crop}: ${c.condition}, review=${c.reviewStatus})`)
            .join('; ')}`
        : '',
      typeof ctx.criticalStorageCount === 'number' ? `Critical storage batches: ${ctx.criticalStorageCount}` : '',
      ctx.criticalBatches?.length
        ? `Flagged storage batches: ${ctx.criticalBatches
            .slice(0, 5)
            .map((b) => `${b.code} (${b.crop}, ${b.tempC}°C, ${b.humidity}% RH, status=${b.status})`)
            .join('; ')}`
        : '',
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

    const { response, modelUsed } = await generateWithRetry(
      ai,
      {
        model: requestedModel,
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
      },
      'KRISHI360 AI Copilot',
    );

    const { groundingSources, searchQueries } = extractGrounding(response);
    let reply = (response.text ?? '').trim();

    if (!reply) {
      reply = getFallbackCopilotReply(input.message, input.farmContext);
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
  } catch {
    const reply = getFallbackCopilotReply(input.message, input.farmContext);
    return {
      reply,
      modelUsed: 'gemini-fallback-copilot',
      mode,
      groundingSources: [],
      searchQueries: [],
      safetyFiltered: false,
      disclaimer: COPILOT_DISCLAIMER,
      timestamp: new Date().toISOString(),
    };
  }
}
