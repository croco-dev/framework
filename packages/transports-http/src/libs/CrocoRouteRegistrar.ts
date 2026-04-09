import { randomUUID } from 'node:crypto';
import { Context as FrameworkContext } from '@croco/framework-context';
import { ProblemFactory } from '@croco/problems-core';
import type { Hono, Context as HonoContext } from 'hono';
import type { ErrorHandler } from './ErrorHandler';
import { HttpContext } from './HttpContext';
import { parseTraceParent, type TraceParent, telemetryMiddleware } from './middleware/telemetry';
import type { CompiledRoute, MiddlewareFunction } from './types';

/**
 * 컴파일된 라우트를 Hono 인스턴스에 등록하고 공통 미들웨어를 적용합니다.
 */
export class CrocoRouteRegistrar {
  constructor(
    private readonly hono: Hono,
    private readonly errorHandler: ErrorHandler,
    private readonly globalMiddlewares: MiddlewareFunction[]
  ) {}

  register(route: CompiledRoute): void {
    const method = route.method.toLowerCase();
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
      const middlewares = [telemetry, ...this.globalMiddlewares];

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

    const headHandler = async (c: HonoContext) => {
      const response = await honoHandler(c);

      return new Response(null, {
        status: response.status,
        headers: response.headers,
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
        this.hono.on('HEAD', route.path, headHandler);
        break;
      case 'all':
        this.hono.all(route.path, honoHandler);
        break;
      default:
        throw ProblemFactory.internalServerError(
          'transports-http/unsupported-route-method',
          `Unsupported route method: ${route.method}`
        );
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
}
