import type { APIGatewayProxyEvent } from 'aws-lambda';
import type { AppConfig } from '../config/env';
import type { LambdaHandler } from '../types/api';
import { NotFoundError } from '../utils/errors';
import { randomUUID } from 'node:crypto';
import { errorResponse } from '../utils/response';

export interface Route {
  method: string;
  /** API Gateway resource template, e.g. /crop-cases/{id}/analysis */
  resource: string;
  handler: LambdaHandler;
}

/** Dispatches by (httpMethod, resource). REST API sets event.resource. */
export function createRouter(routes: Route[], config: AppConfig): LambdaHandler {
  return async (event: APIGatewayProxyEvent) => {
    const route = routes.find(
      (r) => r.method === event.httpMethod && r.resource === (event.resource ?? event.path),
    );
    if (!route) {
      return errorResponse(new NotFoundError('Route not found.'), {
        requestId: event.requestContext?.requestId ?? randomUUID(),
        config,
      });
    }
    return route.handler(event);
  };
}

/** Lazily-built SAM entry point shared by all module handlers. */
export function lazyRouter(build: () => { routes: Route[]; config: AppConfig }): LambdaHandler {
  let router: LambdaHandler | undefined;
  return async (event) => {
    if (!router) {
      const { routes, config } = build();
      router = createRouter(routes, config);
    }
    return router(event);
  };
}