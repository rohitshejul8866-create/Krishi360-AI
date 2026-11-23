import 'dotenv/config';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import express from 'express';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createServer as createViteServer } from 'vite';
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
import { seedDemoPortalData } from './backend/src/seed/demoPortalSeed';
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
    DATA_BACKEND: process.env.DATA_BACKEND ?? 'memory',
    AI_PROVIDER: process.env.AI_PROVIDER ?? 'heuristic',
    ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS ?? allowedOrigins.join(','),
    PORT: String(port),
  });

  const container = buildContainer(config);
  setContainer(container);

  if (config.dataBackend === 'dynamodb') {
    try {
      await ensureDynamoTable(config);
      const existing = await container.repos.schemes.list({}, { limit: 1 });
      if (existing.items.length === 0) {
        await seedDemoPortalData(container.repos);
      }
    } catch (err) {
      console.warn(
        'DynamoDB startup init skipped:',
        err instanceof Error ? err.message : String(err),
      );
    }
  } else {
    await seedDemoPortalData(container.repos);
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
  ];
  const compiled = compileRoutes(routes);
  const router = createRouter(routes, config);

  const app = express();
  app.disable('x-powered-by');
  const httpServer = http.createServer(app);
  app.use('/api', express.text({ type: '*/*', limit: '2mb' }));

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
    console.log(`KRISHI360 server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
