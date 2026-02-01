import { randomUUID } from 'node:crypto';
import { Container, Context as FrameworkContext } from '@croco/framework-context';
import type { Logger } from '@croco/framework-logger';
import { Hono, type Context as HonoContext } from 'hono';
import type { ErrorHandler } from './ErrorHandler';
import { HttpContext } from './HttpContext';

import { type CompileOptions, RouteCompiler } from './RouteCompiler';
import type { AppConfig, CompiledRoute, LambdaContext, LambdaEvent, LambdaHandler, MiddlewareFunction } from './types';

export class CrocoApp {
  private hono: Hono;
  private routes: CompiledRoute[] = [];
  private errorHandler: ErrorHandler;
  private booted = false;
  private logger: Logger;

  constructor(private config: AppConfig) {
    this.hono = new Hono();
    // Resolve dependencies manually since CrocoApp is the entry point
    this.logger = Container.get(Logger);
    this.errorHandler = Container.get(ErrorHandler);
  }

  private boot(options: CompileOptions = {}): void {
    if (this.booted) return;

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

  private registerRoute(route: CompiledRoute): void {
    const method = route.method.toLowerCase();

    const honoHandler = async (c: HonoContext) => {
      const ctx = new HttpContext(c);

      return FrameworkContext.run({ requestId: randomUUID() }, async () => {
        try {
          if (this.config.middlewares?.length) {
            await this.executeMiddlewares(ctx, this.config.middlewares);
          }

          const result = await route.handler(ctx);

          if (result instanceof Response) {
            return result;
          }

          if (result === undefined || result === null) {
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
        body = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf-8') : event.body;
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

      const responseBody = await response.text();
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      return {
        statusCode: response.status,
        headers: responseHeaders,
        body: responseBody,
        isBase64Encoded: false,
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
