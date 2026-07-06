import { randomUUID } from "node:crypto";
import {
  Container,
  Context as FrameworkContext,
  finishRuntimeInspectionRequest,
  type ILogger,
  type RuntimeInspector,
  type RuntimeContext,
  type RuntimeTraceContext,
  recordRuntimeInspectionEvent,
  startRuntimeInspectionRequest,
} from "@croco/framework-context";
import {
  Problem,
  ProblemCategory,
  ProblemCategoryMapper,
  ProblemFactory,
} from "@croco/problems-core";
import type { Hono, Context as HonoContext } from "hono";
import type { ErrorHandler } from "./ErrorHandler";
import { HttpContext } from "./HttpContext";
import { isMiddlewareShortCircuit } from "./middleware/MiddlewareShortCircuit";
import { getSecurityMiddlewareExportName } from "./middleware/SecurityMiddlewareMarker";
import { parseTraceParent, type TraceParent, telemetryMiddleware } from "./middleware/telemetry";
import {
  createRuntimeContext,
  getRuntimeContextInitFromEnv,
  type RuntimeContextInit,
} from "./runtimeContext";
import { describeHttpPipelineGraph } from "./PipelineRunner";
import type { CompiledRoute, MiddlewareFunction } from "./types";

const HTTP_MIDDLEWARE_MISSING_CONTINUATION_CODE = "CROCO_HTTP_MIDDLEWARE_001";
const HTTP_MIDDLEWARE_MULTIPLE_NEXT_CODE = "CROCO_HTTP_MIDDLEWARE_002";
const LEGACY_MIDDLEWARE_MULTIPLE_NEXT_PROBLEM = {
  code: "transports-http/middleware-next-called-multiple-times",
  category: ProblemCategory.InternalServerError,
} as const;

/**
 * 컴파일된 라우트를 Hono 인스턴스에 등록하고 공통 미들웨어를 적용합니다.
 */
export class CrocoRouteRegistrar {
  private runtimeInspector?: RuntimeInspector;

  constructor(
    private readonly hono: Hono,
    private readonly errorHandler: ErrorHandler,
    private readonly globalMiddlewares: MiddlewareFunction[],
    private readonly logger: ILogger,
  ) {}

  setRuntimeInspector(inspector: RuntimeInspector): void {
    this.runtimeInspector = inspector;
  }

  register(route: CompiledRoute): void {
    const method = route.method.toLowerCase();
    const telemetry = telemetryMiddleware(route.path);
    const middlewares = [telemetry, ...this.globalMiddlewares];

    route.pipelineGraph = describeHttpPipelineGraph({
      ...route.pipelineGraphConfig,
      target: route.pipelineGraphConfig?.target ?? `${route.method.toUpperCase()} ${route.path}`,
      middlewares,
    });

    const honoHandler = async (c: HonoContext) => {
      const ctx = new HttpContext(c);
      const traceparent = ctx.header("traceparent");
      const traceContext: TraceParent | null = parseTraceParent(traceparent ?? null);
      const fallbackRequestId = ctx.header("x-request-id") ?? randomUUID();
      const runtime = this.resolveRuntimeContext(c, fallbackRequestId, traceContext);
      const inspector = this.runtimeInspector;
      const inspection = startRuntimeInspectionRequest(
        inspector,
        {
          requestId: runtime.requestId,
          method: ctx.req.method,
          path: ctx.req.path,
          route: route.path,
          url: ctx.req.url,
          headers: ctx.req.headers,
          query: ctx.req.query,
          runtime: this.describeRuntime(runtime),
          trace: this.describeTrace(runtime.trace),
        },
        (error) => this.reportInspectorFailure(error),
      );
      const requestContext = {
        requestId: runtime.requestId,
        inspectionId: inspection?.id,
        traceId: runtime.trace?.traceId,
        spanId: runtime.trace?.spanId,
        traceFlags: runtime.trace?.traceFlags,
        runtime,
        runtimeInspector: inspector,
      };
      return FrameworkContext.run(requestContext, async () => {
        let middlewareStartedAt: number | undefined;
        try {
          this.recordInspectionEvent(inspector, {
            kind: "request.context",
            outcome: "started",
            details: {
              requestId: runtime.requestId,
              runtimePlatform: runtime.platform,
              traceId: runtime.trace?.traceId,
              spanId: runtime.trace?.spanId,
            },
          });
          this.recordInspectionEvent(inspector, {
            kind: "di.snapshot",
            outcome: "started",
            details: this.getDiagnosticsSnapshot(),
          });
          middlewareStartedAt = Date.now();
          this.recordInspectionEvent(inspector, {
            kind: "middleware.start",
            outcome: "started",
            details: {
              count: middlewares.length,
            },
          });
          let response = await this.executeMiddlewares(
            ctx,
            middlewares,
            async () => {
              const handlerStartedAt = Date.now();
              this.recordInspectionEvent(inspector, {
                kind: "handler.start",
                outcome: "started",
                name: String(route.methodName),
                details: {
                  route: route.path,
                  method: route.method,
                },
              });

              const result = await route.handler(ctx);
              const handlerResponse = this.toResponse(ctx, result);
              const resultOutcome = handlerResponse.status >= 400 ? "failed" : "succeeded";
              this.recordInspectionEvent(inspector, {
                kind: "handler.end",
                outcome: resultOutcome,
                name: String(route.methodName),
                durationMs: Date.now() - handlerStartedAt,
                details: {
                  resultType: this.describeResult(result),
                  responseStatus: handlerResponse.status,
                },
              });

              return handlerResponse;
            },
            inspector,
          );
          response = this.withContextResponseHeaders(ctx, response);
          const responseOutcome = response.status >= 400 ? "failed" : "succeeded";
          this.recordInspectionEvent(inspector, {
            kind: "middleware.end",
            outcome: "succeeded",
            durationMs: Date.now() - middlewareStartedAt,
            details: {
              traceId: ctx.get("traceId"),
              telemetryDegraded: ctx.get("telemetryDegraded") ?? false,
              responseStatus: response.status,
            },
          });
          this.finishInspection(inspector, inspection?.id, response, responseOutcome, ctx);
          return response;
        } catch (error) {
          if (error instanceof Response) {
            const outcome = error.status >= 400 ? "failed" : "succeeded";
            this.recordInspectionEvent(inspector, {
              kind: "middleware.end",
              outcome,
              ...(middlewareStartedAt !== undefined
                ? { durationMs: Date.now() - middlewareStartedAt }
                : {}),
              details: {
                traceId: ctx.get("traceId"),
                telemetryDegraded: ctx.get("telemetryDegraded") ?? false,
                responseStatus: error.status,
              },
            });
            this.finishInspection(inspector, inspection?.id, error, outcome, ctx);
            return error;
          }

          this.recordRouteError(inspector, error);
          const response = this.withContextResponseHeaders(
            ctx,
            this.errorHandler.handleError(error, ctx),
          );
          this.finishInspection(inspector, inspection?.id, response, "failed", ctx, error);
          return response;
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
    inspector: RuntimeInspector | undefined,
  ): Promise<Response> {
    let index = -1;
    let response: Response | undefined;

    const dispatch = async (nextIndex: number): Promise<Response> => {
      if (nextIndex <= index) {
        const middlewareIndex = Math.max(0, nextIndex - 1);
        const middleware = middlewares[middlewareIndex];
        this.recordMiddlewareShortCircuit(inspector, {
          middleware,
          middlewareIndex,
          outcome: "failed",
          reason: "next-called-multiple-times",
          diagnosticCode: HTTP_MIDDLEWARE_MULTIPLE_NEXT_CODE,
        });
        throw ProblemFactory.internalServerError(
          HTTP_MIDDLEWARE_MULTIPLE_NEXT_CODE,
          "Middleware called next() multiple times",
          {
            extensions: {
              legacyCode: LEGACY_MIDDLEWARE_MULTIPLE_NEXT_PROBLEM.code,
            },
          },
        );
      }

      index = nextIndex;

      const middleware = middlewares[nextIndex];
      if (!middleware) {
        response = await terminal();
        return response;
      }

      let nextCalled = false;
      let downstreamResponse: Response | undefined;
      const middlewareResponse = await middleware(ctx, async () => {
        nextCalled = true;
        downstreamResponse = await dispatch(nextIndex + 1);
        return downstreamResponse;
      });
      if (middlewareResponse instanceof Response) {
        if (!nextCalled) {
          this.recordMiddlewareShortCircuit(inspector, {
            middleware,
            middlewareIndex: nextIndex,
            outcome: "succeeded",
            reason: "response-returned",
            responseStatus: middlewareResponse.status,
          });
        }

        if (downstreamResponse && middlewareResponse !== downstreamResponse) {
          ctx.clearBufferedResponseBody();
        }

        response = middlewareResponse;
        return middlewareResponse;
      }

      if (isMiddlewareShortCircuit(middlewareResponse)) {
        if (nextCalled) {
          this.recordMiddlewareShortCircuit(inspector, {
            middleware,
            middlewareIndex: nextIndex,
            outcome: "failed",
            reason: "short-circuit-after-next",
            diagnosticCode: HTTP_MIDDLEWARE_MISSING_CONTINUATION_CODE,
          });
          throw this.createInvalidMiddlewareResultProblem(middleware, nextIndex);
        }

        response = this.toShortCircuitResponse(ctx);
        this.recordMiddlewareShortCircuit(inspector, {
          middleware,
          middlewareIndex: nextIndex,
          outcome: "succeeded",
          reason: middlewareResponse.reason,
          responseStatus: response.status,
        });
        return response;
      }

      if (nextCalled) {
        if (downstreamResponse) {
          return downstreamResponse;
        }

        if (response) {
          return response;
        }
      }

      this.recordMiddlewareShortCircuit(inspector, {
        middleware,
        middlewareIndex: nextIndex,
        outcome: "failed",
        reason: middlewareResponse === undefined ? "missing-next" : "invalid-return",
        diagnosticCode: HTTP_MIDDLEWARE_MISSING_CONTINUATION_CODE,
      });
      throw this.createInvalidMiddlewareResultProblem(middleware, nextIndex);
    };

    return dispatch(0);
  }

  private createInvalidMiddlewareResultProblem(
    middleware: MiddlewareFunction,
    middlewareIndex: number,
  ): Problem {
    return ProblemFactory.internalServerError(
      HTTP_MIDDLEWARE_MISSING_CONTINUATION_CODE,
      "Middleware must return a Response, return shortCircuit(reason), or call next() exactly once.",
      {
        extensions: {
          middleware: this.describeMiddleware(middleware, middlewareIndex),
          middlewareIndex,
        },
      },
    );
  }

  private toResponse(ctx: HttpContext, result: unknown): Response {
    if (result instanceof Response) {
      ctx.res.status = result.status;
      ctx.clearBufferedResponseBody();
      return result;
    }

    if (result === undefined || result === null) {
      ctx.res.status = 204;
      return this.toEmptyResponse(ctx);
    }

    return ctx.jsonResponse(result);
  }

  private toShortCircuitResponse(ctx: HttpContext): Response {
    if (this.isNullBodyStatus(ctx.res.status)) {
      return this.toEmptyResponse(ctx, ctx.res.status);
    }

    return ctx.text("", ctx.res.status);
  }

  private toEmptyResponse(ctx: HttpContext, status = 204): Response {
    return new Response(null, {
      status,
      headers: ctx.raw.res.headers,
    });
  }

  private isNullBodyStatus(status: number): boolean {
    // Fetch Response can preserve final null-body statuses in the 2xx-5xx constructor range.
    return status === 204 || status === 205 || status === 304;
  }

  private recordMiddlewareShortCircuit(
    inspector: RuntimeInspector | undefined,
    input: {
      readonly middleware: MiddlewareFunction | undefined;
      readonly middlewareIndex: number;
      readonly outcome: "succeeded" | "failed";
      readonly reason: string;
      readonly responseStatus?: number;
      readonly diagnosticCode?: string;
    },
  ): void {
    const middlewareName =
      input.middleware === undefined
        ? `middleware[${input.middlewareIndex}]`
        : this.describeMiddleware(input.middleware, input.middlewareIndex);

    this.recordInspectionEvent(inspector, {
      kind: "middleware.short-circuit",
      outcome: input.outcome,
      name: middlewareName,
      details: {
        middleware: middlewareName,
        middlewareIndex: input.middlewareIndex,
        reason: input.reason,
        ...(input.responseStatus !== undefined ? { responseStatus: input.responseStatus } : {}),
        ...(input.diagnosticCode !== undefined ? { diagnosticCode: input.diagnosticCode } : {}),
      },
    });
  }

  private describeMiddleware(middleware: MiddlewareFunction, fallbackIndex: number): string {
    const securityExportName = getSecurityMiddlewareExportName(middleware);
    if (securityExportName) {
      return securityExportName;
    }

    if (middleware.name.length > 0) {
      return middleware.name;
    }

    return `middleware[${fallbackIndex}]`;
  }

  private withContextResponseHeaders(ctx: HttpContext, response: Response): Response {
    const headers = new Headers(response.headers);
    let hasContextHeaders = false;

    ctx.raw.res.headers.forEach((value, key) => {
      headers.set(key, value);
      hasContextHeaders = true;
    });

    for (const [key, value] of Object.entries(ctx.res.headers)) {
      headers.set(key, value);
      hasContextHeaders = true;
    }

    if (!hasContextHeaders) {
      return response;
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
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

    return createRuntimeContext(this.withResolvedRuntimeContext(init, fallbackRequestId, trace));
  }

  private withResolvedRuntimeContext(
    init: RuntimeContextInit,
    fallbackRequestId: string,
    trace: RuntimeTraceContext | undefined,
  ): RuntimeContextInit {
    const capabilities = {
      ...init.capabilities,
      logger: init.capabilities?.logger ?? true,
      trace: init.capabilities?.trace ?? trace !== undefined,
    } as NonNullable<RuntimeContextInit["capabilities"]>;

    return {
      ...init,
      requestId: init.requestId ?? fallbackRequestId,
      logger: init.logger ?? this.logger,
      trace,
      capabilities,
    } as RuntimeContextInit;
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
          filesystem: false,
          waitUntil: true,
          flush: false,
          nodeApi: false,
          requestLifecycle: true,
          streamingResponse: true,
          deadline: false,
          abortSignal: true,
          shutdown: false,
        },
      };
    }

    return {
      platform: "node",
      env: process.env,
      capabilities: {
        env: true,
        filesystem: true,
        waitUntil: false,
        flush: false,
        nodeApi: true,
        requestLifecycle: true,
        streamingResponse: true,
        deadline: false,
        abortSignal: true,
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

  private describeRuntime(runtime: RuntimeContext): Record<string, unknown> {
    return {
      platform: runtime.platform,
      requestId: runtime.requestId,
      capabilities: runtime.capabilities,
    };
  }

  private recordInspectionEvent(
    inspector: RuntimeInspector | undefined,
    input: Parameters<typeof recordRuntimeInspectionEvent>[1],
  ): void {
    recordRuntimeInspectionEvent(inspector, input, (error) => this.reportInspectorFailure(error));
  }

  private getDiagnosticsSnapshot(): Record<string, unknown> {
    try {
      return Container.getDiagnosticsSnapshot();
    } catch (error) {
      const normalizedError = error instanceof Error ? error : new Error(String(error));
      this.reportInspectorFailure(normalizedError);
      return {
        unavailable: true,
        error: {
          name: normalizedError.name,
          message: normalizedError.message,
        },
      };
    }
  }

  private describeTrace(
    traceContext: RuntimeTraceContext | undefined,
  ): Record<string, unknown> | undefined {
    if (!traceContext) {
      return undefined;
    }

    return {
      traceId: traceContext.traceId,
      spanId: traceContext.spanId,
      traceFlags: traceContext.traceFlags,
    };
  }

  private describeResult(result: unknown): string {
    if (result instanceof Response) {
      return "Response";
    }

    if (result === null) {
      return "null";
    }

    if (Array.isArray(result)) {
      return "array";
    }

    return typeof result;
  }

  private recordRouteError(inspector: RuntimeInspector | undefined, error: unknown): void {
    if (!inspector) {
      return;
    }

    if (error instanceof Problem) {
      this.recordInspectionEvent(inspector, {
        kind: "problem",
        outcome: "failed",
        name: error.code,
        details: {
          code: error.code,
          category: error.category,
          status: ProblemCategoryMapper.toHttpStatus(error.category),
          title: error.title,
          detail: error.detail,
        },
      });
      return;
    }

    const normalizedError = error instanceof Error ? error : new Error(String(error));
    this.recordInspectionEvent(inspector, {
      kind: "error",
      outcome: "failed",
      name: normalizedError.name,
      details: {
        name: normalizedError.name,
        message: normalizedError.message,
      },
    });
  }

  private finishInspection(
    inspector: RuntimeInspector | undefined,
    inspectionId: string | undefined,
    response: Response,
    outcome: "succeeded" | "failed",
    ctx: HttpContext,
    error?: unknown,
  ): void {
    if (!inspector) {
      return;
    }

    this.recordInspectionEvent(inspector, {
      kind: "di.snapshot",
      outcome,
      details: this.getDiagnosticsSnapshot(),
    });
    finishRuntimeInspectionRequest(
      inspector,
      {
        inspectionId,
        status: response.status,
        outcome,
        details: {
          traceId: ctx.get("traceId"),
          telemetryDegraded: ctx.get("telemetryDegraded") ?? false,
          error:
            error instanceof Error
              ? {
                  name: error.name,
                  message: error.message,
                }
              : undefined,
        },
      },
      (error) => this.reportInspectorFailure(error),
    );
  }

  private reportInspectorFailure(error: Error): void {
    try {
      this.logger.warn("Dev Inspector instrumentation failed", {
        name: error.name,
        message: error.message,
      });
    } catch {
      /* logging must not affect request handling */
    }
  }
}
