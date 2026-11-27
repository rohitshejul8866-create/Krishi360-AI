import { z } from 'zod';
import type { AppConfig } from '../config/env';
import { getContainer } from '../container';
import { withHttp } from '../middleware/withHttp';
import { runKrishiCopilotChat, runLiveIntelligenceBrief } from '../services/ai/copilot';
import { createAiService } from '../services/ai/factory';
import type { AiAnalysisService } from '../services/ai/types';
import { AppError, ServiceUnavailableError } from '../utils/errors';
import type { Route } from './router';
import { lazyRouter } from './router';

export const liveIntelBodySchema = z
  .object({
    region: z.string().trim().min(2).max(120).optional(),
  })
  .optional();

export const chatBodySchema = z.object({
  message: z.string().trim().min(1).max(3000),
  mode: z.enum(['grounded', 'fast']).default('grounded'),
  history: z
    .array(
      z.object({
        sender: z.enum(['user', 'assistant']),
        text: z.string().trim().min(1).max(3000),
      }),
    )
    .max(24)
    .default([]),
  farmContext: z
    .object({
      farmerName: z.string().trim().max(120).optional(),
      location: z.string().trim().max(160).optional(),
      crops: z.array(z.string().trim().max(80)).max(20).optional(),
      plotsCount: z.number().int().min(0).max(500).optional(),
      openCasesCount: z.number().int().min(0).max(500).optional(),
      criticalStorageCount: z.number().int().min(0).max(500).optional(),
      activeAlertsCount: z.number().int().min(0).max(500).optional(),
      recentCases: z
        .array(
          z.object({
            id: z.string().trim().max(64),
            crop: z.string().trim().max(80),
            condition: z.string().trim().max(160),
            reviewStatus: z.string().trim().max(40),
          }),
        )
        .max(6)
        .optional(),
      criticalBatches: z
        .array(
          z.object({
            code: z.string().trim().max(64),
            crop: z.string().trim().max(80),
            tempC: z.number(),
            humidity: z.number(),
            status: z.string().trim().max(40),
          }),
        )
        .max(6)
        .optional(),
    })
    .optional(),
});

export const cropAnalyzeBodySchema = z.object({
  crop: z.string().trim().min(1).max(80),
  plantPart: z.string().trim().min(1).max(80),
  location: z.string().trim().max(160).default('India'),
  symptoms: z.string().trim().max(1500).default(''),
  imageBase64: z.string().min(1).max(11_000_000).optional(),
  imageMimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']).optional(),
});

export function buildAiRoutes(config: AppConfig, aiService: AiAnalysisService = createAiService(config)): Route[] {
  return [
    {
      method: 'POST',
      resource: '/ai/live-intelligence',
      handler: withHttp({ auth: 'none', body: liveIntelBodySchema }, config, async (ctx) => {
        try {
          const region = ctx.body?.region;
          return { data: await runLiveIntelligenceBrief(region || 'Nashik, Maharashtra') };
        } catch (err) {
          if (err instanceof AppError) throw err;
          throw new ServiceUnavailableError(
            'AI_LIVE_INTELLIGENCE_UNAVAILABLE',
            err instanceof Error
              ? err.message
              : 'Unable to fetch grounded agricultural intelligence from Gemini right now.',
          );
        }
      }),
    },
    {
      method: 'POST',
      resource: '/ai/chat',
      handler: withHttp({ auth: 'none', body: chatBodySchema }, config, async (ctx) => {
        try {
          return { data: await runKrishiCopilotChat(ctx.body) };
        } catch (err) {
          if (err instanceof AppError) throw err;
          throw new ServiceUnavailableError(
            'AI_CHAT_UNAVAILABLE',
            err instanceof Error
              ? err.message
              : 'KRISHI360 AI Copilot could not reach Gemini right now. Please try again.',
          );
        }
      }),
    },
    {
      method: 'POST',
      resource: '/ai/crop-analyze',
      handler: withHttp({ auth: 'none', body: cropAnalyzeBodySchema }, config, async (ctx) => {
        try {
          const { crop, plantPart, location, symptoms, imageBase64, imageMimeType } = ctx.body;
          const analysis = await aiService.analyze({
            crop,
            plantPart,
            location: location || 'India',
            symptoms,
            imageData:
              imageBase64 && imageMimeType
                ? { base64: imageBase64, mimeType: imageMimeType }
                : undefined,
          });
          return { data: { analysis }, simulated: analysis.simulated };
        } catch (err) {
          throw new ServiceUnavailableError(
            'AI_CROP_ANALYZE_FAILED',
            err instanceof Error ? err.message : 'Crop AI analysis failed.',
          );
        }
      }),
    },
  ];
}

export const handler = lazyRouter(() => {
  const container = getContainer();
  return {
    routes: buildAiRoutes(container.config, createAiService(container.config)),
    config: container.config,
  };
});
