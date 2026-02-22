import { randomUUID } from 'node:crypto';
import { Container, Context as FrameworkContext } from '@croco/framework-context';
import { Logger } from '@croco/framework-logger';
import { Hono, type Context as HonoContext } from 'hono';
import { ErrorHandler } from './ErrorHandler';
import { HealthCheckRegistry } from './HealthCheckRegistry';
import { HttpContext } from './HttpContext';
import { telemetryMiddleware, parseTraceParent, type TraceParent } from './middleware/telemetry';

import { type CompileOptions, RouteCompiler } from './RouteCompiler';
import type { AppConfig, CompiledRoute, LambdaContext, LambdaEvent, LambdaHandler, MiddlewareFunction } from './types';


function isBinaryContentType(contentType: string): boolean {
  const mimeType = contentType.split(';', 1)[0]?.trim().toLowerCase() ?? '';

  if (mimeType === '') {
    return false;
  }

  if (mimeType.startsWith('text/')) {
    return false;
  }

  if (
    mimeType.includes('json') ||
    mimeType.includes('xml') ||
    mimeType.includes('javascript') ||
    mimeType === 'application/x-www-form-urlencoded'
  ) {
    return false;
  }

  return true;
}

export class CrocoApp {
  private hono: Hono;
  private routes: CompiledRoute[] = [];
  private errorHandler: ErrorHandler;
  private healthCheckRegistry: HealthCheckRegistry;
  private booted = false;
  private logger: Logger;

  constructor(private config: AppConfig) {
    this.hono = new Hono();
    // Resolve dependencies manually since CrocoApp is the entry point
    this.logger = Container.get(Logger);
    this.errorHandler = Container.get(ErrorHandler);
    this.healthCheckRegistry = Container.get(HealthCheckRegistry);
  }

  private boot(options: CompileOptions = {}): void {
    if (this.booted) return;

    this.registerSystemRoutes();

    const compiler = new RouteCompiler();
    this.routes = compiler.compile(this.config.controllers, {
      ...options,
      globalGuards: this.config.globalGuards,
      globalInterceptors: this.config.globalInterceptors,
      globalFilters: this.config.globalFilters,
      globalPipes: this.config.globalPipes,
    });

    for (const route of this.routes) {
      this.registerRoute(route);
    }

    this.booted = true;
  }

  private registerSystemRoutes(): void {
    this.hono.get('/health', (c) => c.json({ status: 'ok' }));

    this.hono.get('/ready', async (c) => {
      const result = await this.healthCheckRegistry.check();
      return c.json(result, result.status === 'ok' ? 200 : 503);
    });
  }

  private registerRoute(route: CompiledRoute): void {
    const method = route.method.toLowerCase();

    // Create telemetry middleware once at route registration (not per-request)
    const telemetry = telemetryMiddleware(route.path);

    const honoHandler = async (c: HonoContext) => {
      const ctx = new HttpContext(c);

      const traceparent = ctx.header('traceparent');
      const traceContext: TraceParent | null = parseTraceParent(traceparent ?? null);
      const requestContext = {
        requestId: randomUUID(),
        traceId: traceContext?.traceId,
        spanId: traceContext?.spanId,
        traceFlags: traceContext?.traceFlags,
      };

      const middlewares = [telemetry, ...(this.config.middlewares ?? [])];

      return FrameworkContext.run(requestContext, async () => {
        try {
          await this.executeMiddlewares(ctx, middlewares);

          const result = await route.handler(ctx);

          if (result instanceof Response) {
            return result;
          }

          if (result === undefined || result === null) {
            ctx.res.status = 204;
            return ctx.text('', 204);
          }

          return ctx.jsonResponse(result);
        } catch (error) {
          return this.errorHandler.handleError(error, ctx);
        }
      });
    };

    switch (method) {
      case 'get':
        this.hono.get(route.path, honoHandler);
        break;
      case 'post':
        this.hono.post(route.path, honoHandler);
        break;
      case 'put':
        this.hono.put(route.path, honoHandler);
        break;
      case 'patch':
        this.hono.patch(route.path, honoHandler);
        break;
      case 'delete':
        this.hono.delete(route.path, honoHandler);
        break;
      case 'options':
        this.hono.options(route.path, honoHandler);
        break;
      case 'head':
        this.hono.get(route.path, honoHandler);
        break;
      case 'all':
        this.hono.all(route.path, honoHandler);
        break;
      default:
        this.hono.all(route.path, honoHandler);
    }
  }

  private async executeMiddlewares(ctx: HttpContext, middlewares: MiddlewareFunction[]): Promise<void> {
    let index = 0;

    const next = async (): Promise<void> => {
      if (index < middlewares.length) {
        const middleware = middlewares[index++];
        await middleware(ctx, next);
      }
    };

    await next();
  }

  lambdaHandler(): LambdaHandler {
    this.boot();

    return async (event: LambdaEvent, lambdaContext: LambdaContext) => {
      const method = event.requestContext?.http?.method || 'GET';
      const path = event.rawPath || '/';
      const queryString = event.rawQueryString || '';
      const url = `https://lambda.local${path}${queryString ? `?${queryString}` : ''}`;

      const headers = new Headers();
      if (event.headers) {
        for (const [key, value] of Object.entries(event.headers)) {
          if (value) headers.set(key, value);
        }
      }

      let body: BodyInit | null = null;
      if (event.body) {
        body = event.isBase64Encoded ? Buffer.from(event.body, 'base64') : event.body;
      }

      const request = new Request(url, {
        method,
        headers,
        body: ['GET', 'HEAD'].includes(method) ? null : body,
      });

      const response = await this.hono.fetch(request, {
        event,
        lambdaContext,
      });

      const contentType = response.headers.get('content-type') || '';
      const isBinary = isBinaryContentType(contentType);
      const responseBody = isBinary
        ? Buffer.from(await response.arrayBuffer()).toString('base64')
        : await response.text();
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      return {
        statusCode: response.status,
        headers: responseHeaders,
        body: responseBody,
        isBase64Encoded: isBinary,
      };
    };
  }

  getHono(): Hono {
    this.boot();
    return this.hono;
  }

  async listen(port: number, callback?: () => void): Promise<void> {
    this.boot();

    const { serve } = await import('@hono/node-server');

    serve(
      {
        fetch: this.hono.fetch,
        port,
      },
      () => {
        this.logger.info(`Server running on http://localhost:${port}`);
        callback?.();
      }
    );
  }

  async fetch(request: Request): Promise<Response> {
    this.boot();
    return this.hono.fetch(request);
  }
}

export function createApp(config: AppConfig): CrocoApp {
  return new CrocoApp(config);
}
