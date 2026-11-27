import 'dotenv/config';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import express from 'express';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createServer as createViteServer } from 'vite';
import { z } from 'zod';
import { loadConfig } from './backend/src/config/env';
import { buildContainer, setContainer } from './backend/src/container';
import { buildAuthRoutes } from './backend/src/handlers/auth';
import { buildBackendRoutes } from './backend/src/handlers/backend';
import { buildCropDoctorRoutes } from './backend/src/handlers/cropCases';
import { buildJalSenseRoutes } from './backend/src/handlers/farms';
import { buildMandiRoutes } from './backend/src/handlers/mandi';
import { createRouter, type Route } from './backend/src/handlers/router';
import { buildAuditRoutes, buildSchemeRoutes } from './backend/src/handlers/schemes';
import { buildGrainGuardRoutes } from './backend/src/handlers/storage';
import { buildWorkspaceRoutes } from './backend/src/handlers/workspace';
import { closeSqliteDbs } from './backend/src/repositories/sqlite/client';
import { seedDemoPortalData } from './backend/src/seed/demoPortalSeed';
import { runKrishiCopilotChat, runLiveIntelligenceBrief } from './backend/src/services/ai/copilot';
import { createAiService } from './backend/src/services/ai/factory';
import { ensureDynamoTable } from './backend/src/services/awsDatabaseService';

interface CompiledRoute {
  route: Route;
  regex: RegExp;
  paramNames: string[];
}

function compileRoutes(routes: Route[]): CompiledRoute[] {
  return routes.map((route) => {
    const paramNames: string[] = [];
    const pattern = route.resource
      .split('/')
      .map((seg) => {
        if (seg.startsWith('{') && seg.endsWith('}')) {
          paramNames.push(seg.slice(1, -1));
          return '([^/]+)';
        }
        return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      })
      .join('/');
    return { route, regex: new RegExp(`^${pattern}$`), paramNames };
  });
}

function normalizeHeaders(raw: express.Request['headers']): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === 'string') out[k] = v;
    else if (Array.isArray(v) && v.length > 0) out[k] = v[0];
  }
  return out;
}

function normalizeQuery(raw: express.Request['query']): Record<string, string> | null {
  const entries = Object.entries(raw);
  if (entries.length === 0) return null;
  const out: Record<string, string> = {};
  for (const [k, v] of entries) {
    if (typeof v === 'string') out[k] = v;
    else if (Array.isArray(v) && typeof v[0] === 'string') out[k] = v[0];
  }
  return out;
}

async function startServer() {
  const port = Number(process.env.PORT || 3000);
  const allowedOrigins = [`http://localhost:${port}`, `http://127.0.0.1:${port}`];
  if (process.env.APP_URL) allowedOrigins.push(process.env.APP_URL);

  const config = loadConfig({
    ...process.env,
    NODE_ENV: process.env.NODE_ENV ?? 'development',
    AUTH_MODE: process.env.AUTH_MODE ?? 'dev',
    DATA_BACKEND: process.env.DATA_BACKEND ?? 'sqlite',
    AI_PROVIDER:
      process.env.AI_PROVIDER ??
      (process.env.GEMINI_API_KEY?.trim()
        ? 'gemini'
        : process.env.AWS_BEARER_TOKEN_BEDROCK || process.env.AWS_BEARER_TOKEN
          ? 'bedrock'
          : 'gemini'),
    ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS ?? allowedOrigins.join(','),
    PORT: String(port),
  });

  const container = buildContainer(config);
  const aiService = createAiService(config);
  setContainer(container);

  if (config.dataBackend === 'dynamodb') {
    try {
      await ensureDynamoTable(config);
      await seedDemoPortalData(container.repos, { mode: 'missing' });
    } catch (err) {
      console.warn(
        'DynamoDB startup init skipped:',
        err instanceof Error ? err.message : String(err),
      );
    }
  } else {
    await seedDemoPortalData(container.repos, { mode: 'missing' });
  }

  const routes: Route[] = [
    ...buildAuthRoutes(config, container),
    ...buildBackendRoutes(config, container),
    ...buildCropDoctorRoutes(config, container),
    ...buildMandiRoutes(config, container),
    ...buildJalSenseRoutes(config, container),
    ...buildGrainGuardRoutes(config, container),
    ...buildSchemeRoutes(config, container),
    ...buildAuditRoutes(config, container),
    ...buildWorkspaceRoutes(config, container),
  ];
  const compiled = compileRoutes(routes);
  const router = createRouter(routes, config);

  const app = express();
  app.disable('x-powered-by');
  const httpServer = http.createServer(app);
  const liveIntelBodySchema = z
    .object({
      region: z.string().trim().min(2).max(120).optional(),
    })
    .optional();

  const chatBodySchema = z.object({
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
      })
      .optional(),
  });

  const cropAnalyzeBodySchema = z.object({
    crop: z.string().trim().min(1).max(80),
    plantPart: z.string().trim().min(1).max(80),
    location: z.string().trim().max(160).default('India'),
    symptoms: z.string().trim().max(1500).default(''),
    imageBase64: z.string().min(1).max(11_000_000).optional(),
    imageMimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']).optional(),
  });

  app.post('/api/ai/live-intelligence', express.json({ limit: '64kb' }), async (req, res) => {
    try {
      const parsed = liveIntelBodySchema.safeParse(req.body);
      const region = parsed.success ? parsed.data?.region : undefined;
      const result = await runLiveIntelligenceBrief(region || 'Nashik, Maharashtra');
      res.json({
        data: result,
        groundingMetadata: {
          groundingSources: result.groundingSources,
          searchQueries: result.searchQueries,
        },
      });
    } catch (err) {
      console.error('Live intelligence error:', err instanceof Error ? err.message : err);
      res.status(503).json({
        error:
          err instanceof Error && err.message.includes('not configured')
            ? err.message
            : 'Unable to fetch grounded agricultural intelligence from Gemini right now.',
      });
    }
  });

  app.post('/api/ai/chat', express.json({ limit: '512kb' }), async (req, res) => {
    const parsed = chatBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Enter a valid question for KRISHI360 AI Copilot.' });
    }
    try {
      const result = await runKrishiCopilotChat(parsed.data);
      res.json({ data: result });
    } catch (err) {
      console.error('AI chat error:', err instanceof Error ? err.message : err);
      res.status(503).json({
        error:
          err instanceof Error && err.message.includes('not configured')
            ? err.message
            : 'KRISHI360 AI Copilot could not reach Gemini right now. Please try again.',
      });
    }
  });

  app.post('/api/ai/crop-analyze', express.json({ limit: '12mb' }), async (req, res) => {
    const parsed = cropAnalyzeBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid crop analysis payload.' });
    }
    try {
      const { crop, plantPart, location, symptoms, imageBase64, imageMimeType } = parsed.data;
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
      res.json({ data: { analysis } });
    } catch (err) {
      console.error('AI crop-analyze error:', err instanceof Error ? err.message : err);
      res.status(503).json({
        error: err instanceof Error ? err.message : 'Gemini Vision crop analysis failed.',
      });
    }
  });

  app.use('/api', express.text({ type: '*/*', limit: '12mb' }));

  app.use('/api', async (req, res) => {
    const apiPath = req.path === '/' ? '/' : req.path.replace(/\/+$/, '');
    let resource = apiPath;
    let pathParameters: Record<string, string> | null = null;

    for (const candidate of compiled) {
      if (candidate.route.method !== req.method && req.method !== 'OPTIONS') continue;
      const match = candidate.regex.exec(apiPath);
      if (match) {
        resource = candidate.route.resource;
        if (candidate.paramNames.length > 0) {
          pathParameters = {};
          candidate.paramNames.forEach((name, idx) => {
            pathParameters![name] = decodeURIComponent(match[idx + 1]);
          });
        }
        break;
      }
    }

    const event = {
      httpMethod: req.method,
      path: apiPath,
      resource,
      headers: normalizeHeaders(req.headers),
      queryStringParameters: normalizeQuery(req.query),
      pathParameters,
      body: typeof req.body === 'string' && req.body.length > 0 ? req.body : null,
      requestContext: { requestId: randomUUID() } as APIGatewayProxyEvent['requestContext'],
    } as APIGatewayProxyEvent;

    const result = await router(event);
    res.status(result.statusCode);
    for (const [k, v] of Object.entries(result.headers ?? {})) {
      if (typeof v === 'string') res.setHeader(k, v);
    }
    res.send(result.body);
  });

  if (process.env.NODE_ENV !== 'production') {
    const disableHmr = process.env.DISABLE_HMR === 'true' || Boolean(process.env.APP_URL);
    const vite = await createViteServer({
      root: path.resolve(process.cwd(), 'frontend'),
      server: {
        middlewareMode: true,
        hmr: disableHmr ? false : { server: httpServer },
        ws: { server: httpServer },
        watch: disableHmr ? null : undefined,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found.');
      }
    });
  }

  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`KRISHI360 server listening on http://0.0.0.0:${port} (backend: ${config.dataBackend})`);
  });

  const shutdown = () => {
    closeSqliteDbs();
    httpServer.close(() => process.exit(0));
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
