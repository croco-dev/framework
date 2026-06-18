import { randomUUID } from "node:crypto";
import {
  Context as FrameworkContext,
  type ILogger,
  type RuntimeTraceContext,
} from "@croco/framework-context";
import { ProblemFactory } from "@croco/problems-core";
import type { Hono, Context as HonoContext } from "hono";
import type { ErrorHandler } from "./ErrorHandler";
import { HttpContext } from "./HttpContext";
import { parseTraceParent, type TraceParent, telemetryMiddleware } from "./middleware/telemetry";
import {
  createRuntimeContext,
  getRuntimeContextInitFromEnv,
  type RuntimeContextInit,
} from "./runtimeContext";
import type { CompiledRoute, MiddlewareFunction } from "./types";

/**
 * 컴파일된 라우트를 Hono 인스턴스에 등록하고 공통 미들웨어를 적용합니다.
 */
export class CrocoRouteRegistrar {
  constructor(
    private readonly hono: Hono,
    private readonly errorHandler: ErrorHandler,
    private readonly globalMiddlewares: MiddlewareFunction[],
    private readonly logger: ILogger,
  ) {}

  register(route: CompiledRoute): void {
    const method = route.method.toLowerCase();
    const telemetry = telemetryMiddleware(route.path);

    const honoHandler = async (c: HonoContext) => {
      const ctx = new HttpContext(c);
      const traceparent = ctx.header("traceparent");
      const traceContext: TraceParent | null = parseTraceParent(traceparent ?? null);
      const fallbackRequestId = ctx.header("x-request-id") ?? randomUUID();
      const runtime = this.resolveRuntimeContext(c, fallbackRequestId, traceContext);
      const requestContext = {
        requestId: runtime.requestId,
        traceId: runtime.trace?.traceId,
        spanId: runtime.trace?.spanId,
        traceFlags: runtime.trace?.traceFlags,
        runtime,
      };
      const middlewares = [telemetry, ...this.globalMiddlewares];

      return FrameworkContext.run(requestContext, async () => {
        try {
          return await this.executeMiddlewares(ctx, middlewares, async () => {
            const result = await route.handler(ctx);
            return this.toResponse(ctx, result);
          });
        } catch (error) {
          if (error instanceof Response) {
            return error;
          }

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
      case "get":
        this.hono.get(route.path, honoHandler);
        break;
      case "post":
        this.hono.post(route.path, honoHandler);
        break;
      case "put":
        this.hono.put(route.path, honoHandler);
        break;
      case "patch":
        this.hono.patch(route.path, honoHandler);
        break;
      case "delete":
        this.hono.delete(route.path, honoHandler);
        break;
      case "options":
        this.hono.options(route.path, honoHandler);
        break;
      case "head":
        this.hono.on("HEAD", route.path, headHandler);
        break;
      case "all":
        this.hono.all(route.path, honoHandler);
        break;
      default:
        throw ProblemFactory.internalServerError(
          "transports-http/unsupported-route-method",
          `Unsupported route method: ${route.method}`,
        );
    }
  }

  private async executeMiddlewares(
    ctx: HttpContext,
    middlewares: MiddlewareFunction[],
    terminal: () => Promise<Response>,
  ): Promise<Response> {
    let index = -1;
    let response: Response | undefined;

    const dispatch = async (nextIndex: number): Promise<void> => {
      if (nextIndex <= index) {
        throw ProblemFactory.internalServerError(
          "transports-http/middleware-next-called-multiple-times",
          "Middleware called next() multiple times",
        );
      }

      index = nextIndex;

      const middleware = middlewares[nextIndex];
      if (!middleware) {
        response = await terminal();
        return;
      }

      await middleware(ctx, () => dispatch(nextIndex + 1));
    };

    await dispatch(0);

    return response ?? this.toShortCircuitResponse(ctx);
  }

  private toResponse(ctx: HttpContext, result: unknown): Response {
    if (result instanceof Response) {
      ctx.res.status = result.status;
      return result;
    }

    if (result === undefined || result === null) {
      ctx.res.status = 204;
      return this.toEmptyResponse(ctx);
    }

    return ctx.jsonResponse(result);
  }

  private toShortCircuitResponse(ctx: HttpContext): Response {
    if (ctx.res.status === 204) {
      return this.toEmptyResponse(ctx);
    }

    return ctx.text("", ctx.res.status);
  }

  private toEmptyResponse(ctx: HttpContext): Response {
    return new Response(null, {
      status: 204,
      headers: ctx.raw.res.headers,
    });
  }

  private resolveRuntimeContext(
    c: HonoContext,
    fallbackRequestId: string,
    traceContext: TraceParent | null,
  ) {
    const existingRuntimeContext = getRuntimeContextInitFromEnv(c.env);
    const init = existingRuntimeContext ?? this.inferRuntimeContext(c);
    const trace = this.resolveTrace(init.trace, traceContext);

    return createRuntimeContext({
      ...init,
      requestId: init.requestId ?? fallbackRequestId,
      logger: init.logger ?? this.logger,
      trace,
      capabilities: {
        ...init.capabilities,
        logger: init.capabilities?.logger ?? true,
        trace: init.capabilities?.trace ?? trace !== undefined,
      },
    });
  }

  private resolveTrace(
    currentTrace: RuntimeTraceContext | undefined,
    traceContext: TraceParent | null,
  ): RuntimeTraceContext | undefined {
    if (!traceContext) {
      return currentTrace;
    }

    return {
      traceId: traceContext.traceId,
      spanId: traceContext.spanId,
      traceFlags: traceContext.traceFlags,
    };
  }

  private inferRuntimeContext(c: HonoContext): RuntimeContextInit {
    const executionContext = this.getExecutionContext(c);

    if (executionContext) {
      return {
        platform: "cloudflare-workers",
        env: this.toRecord(c.env),
        native: { executionContext },
        waitUntil: (promise) => executionContext.waitUntil(promise),
        capabilities: {
          env: true,
          waitUntil: true,
          flush: false,
          shutdown: false,
        },
      };
    }

    return {
      platform: "node",
      env: process.env,
      capabilities: {
        env: true,
        waitUntil: false,
        flush: false,
        shutdown: false,
      },
    };
  }

  private getExecutionContext(
    c: HonoContext,
  ): { waitUntil: (promise: Promise<unknown>) => void } | undefined {
    const candidate = this.readExecutionContext(c);

    if (
      typeof candidate === "object" &&
      candidate !== null &&
      "waitUntil" in candidate &&
      typeof candidate.waitUntil === "function"
    ) {
      const waitUntil = candidate.waitUntil as (promise: Promise<unknown>) => void;

      return {
        waitUntil: (promise) => waitUntil.call(candidate, promise),
      };
    }

    return undefined;
  }

  private readExecutionContext(c: HonoContext): unknown {
    try {
      return (c as HonoContext & { executionCtx?: unknown }).executionCtx;
    } catch {
      return undefined;
    }
  }

  private toRecord(value: unknown): Record<string, unknown> | undefined {
    if (typeof value !== "object" || value === null) {
      return undefined;
    }

    return value as Record<string, unknown>;
  }
}
