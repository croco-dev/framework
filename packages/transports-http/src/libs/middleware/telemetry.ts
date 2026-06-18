import {
  context,
  type Exception,
  propagation,
  type Span,
  type SpanContext,
  SpanKind,
  SpanStatusCode,
  trace,
} from "@opentelemetry/api";
import {
  Container,
  Context as FrameworkContext,
  LOGGER_TOKEN,
  type ILogger,
  type RuntimeTraceContext,
} from "@croco/framework-context";
import { Problem, ProblemCategoryMapper } from "@croco/problems-core";
import type { CrocoHttpContext, MiddlewareFunction } from "../types";

export interface TraceParent {
  traceId: string;
  spanId: string;
  traceFlags: number;
}

/**
 * W3C `traceparent` 헤더를 파싱해 OpenTelemetry span context 형태로 변환합니다.
 */
export function parseTraceParent(header: string | null): TraceParent | null {
  if (!header) {
    return null;
  }

  const parts = header.split("-");
  if (parts.length !== 4) {
    return null;
  }

  const [version, traceId, parentId, flags] = parts;

  if (version !== "00" && version !== "01") {
    return null;
  }

  if (!/^[0-9a-f]{32}$/i.test(traceId)) {
    return null;
  }

  if (!/^[0-9a-f]{16}$/i.test(parentId)) {
    return null;
  }

  if (!/^[0-9a-f]{2}$/i.test(flags)) {
    return null;
  }

  return {
    traceId,
    spanId: parentId,
    traceFlags: Number.parseInt(flags, 16),
  };
}

type HeaderCarrier = Headers | Record<string, string>;

const TELEMETRY_DEGRADED_REASON = "telemetry_setup_failed";
const TELEMETRY_DEGRADED_MESSAGE =
  "[TelemetryMiddleware] Telemetry setup failed; continuing in degraded mode";
const TELEMETRY_DEGRADED_HEADER = "X-Croco-Telemetry-Degraded";

type TelemetrySetupErrorInfo = {
  name: string;
  message: string;
};

type TelemetryDegradationMetadata = {
  route: string;
  method: string;
  path: string;
  traceId: string;
  errorCategory: typeof TELEMETRY_DEGRADED_REASON;
  errorName: string;
  errorMessage: string;
};

const headerGetter = {
  keys(carrier: HeaderCarrier): string[] {
    if (carrier instanceof Headers) {
      return [...carrier.keys()];
    }

    return Object.keys(carrier);
  },
  get(carrier: HeaderCarrier, key: string): string | undefined {
    if (carrier instanceof Headers) {
      return carrier.get(key) ?? undefined;
    }

    return carrier[key] ?? carrier[key.toLowerCase()];
  },
};

/**
 * HTTP 요청마다 서버 Span을 생성하고 traceId를 컨텍스트에 저장하는 미들웨어입니다.
 */
export const telemetryMiddleware =
  (route: string): MiddlewareFunction =>
  async (ctx, next): Promise<void> => {
    let nextCalled = false;

    try {
      const tracer = trace.getTracer("croco-http", "0.0.1");

      const traceParentHeader = ctx.header("traceparent");
      const parentContext = propagation.extract(context.active(), ctx.req.headers, headerGetter);

      const attributes = {
        "http.method": ctx.req.method,
        "http.route": route,
        "http.target": ctx.req.path,
        "http.scheme": new URL(ctx.req.url).protocol.replace(":", ""),
        "http.host": new URL(ctx.req.url).host,
        "http.user_agent": ctx.req.headers["user-agent"] ?? "",
        "http.request.header.traceparent": traceParentHeader ?? "",
      };

      const span = tracer.startSpan(
        `HTTP ${ctx.req.method} ${route}`,
        { kind: SpanKind.SERVER, attributes },
        parentContext,
      );

      applyRequestTraceContext(ctx, span.spanContext());
      span.addEvent("croco.http.request.start", {
        "http.method": ctx.req.method,
        "http.route": route,
        "http.target": ctx.req.path,
      });

      return await context.with(trace.setSpan(context.active(), span), async () => {
        try {
          nextCalled = true;
          await next();

          recordHttpCompletion(span, ctx.res.status);
        } catch (error) {
          recordHttpFailure(span, error, ctx);
          throw error;
        } finally {
          span.addEvent("croco.http.request.end", {
            "http.status_code": ctx.res.status,
          });
          span.end();
        }
      });
    } catch (error) {
      if (nextCalled) {
        throw error;
      }

      const fallbackTraceId = `telemetry-degraded-${Date.now().toString(36)}`;

      ctx.set("traceId", fallbackTraceId);
      ctx.set("telemetryDegraded", true);
      recordTelemetryDegradation(ctx, route, fallbackTraceId, error);

      try {
        await next();
      } finally {
        setTelemetryDegradedHeader(ctx);
      }
    }
  };

function applyRequestTraceContext(ctx: CrocoHttpContext, spanContext: SpanContext): void {
  if (!isValidTraceContext(spanContext)) {
    applyExistingTraceContext(ctx);
    return;
  }

  const traceContext: RuntimeTraceContext = {
    traceId: spanContext.traceId,
    spanId: spanContext.spanId,
    traceFlags: spanContext.traceFlags,
  };

  ctx.set("traceId", spanContext.traceId);
  ctx.set("spanId", spanContext.spanId);
  ctx.set("traceFlags", spanContext.traceFlags);

  const requestContext = FrameworkContext.get();
  if (!requestContext) {
    return;
  }

  requestContext.traceId = spanContext.traceId;
  requestContext.spanId = spanContext.spanId;
  requestContext.traceFlags = spanContext.traceFlags;

  if (requestContext.runtime) {
    requestContext.runtime.trace = traceContext;
    requestContext.runtime.capabilities.trace = true;
  }
}

function applyExistingTraceContext(ctx: CrocoHttpContext): void {
  const requestContext = FrameworkContext.get();
  const traceContext = requestContext?.runtime?.trace ?? requestContext;

  if (!traceContext?.traceId) {
    return;
  }

  ctx.set("traceId", traceContext.traceId);

  if (traceContext.spanId) {
    ctx.set("spanId", traceContext.spanId);
  }

  if (traceContext.traceFlags !== undefined) {
    ctx.set("traceFlags", traceContext.traceFlags);
  }
}

function isValidTraceContext(spanContext: SpanContext): boolean {
  return (
    spanContext.traceId !== "00000000000000000000000000000000" &&
    spanContext.spanId !== "0000000000000000"
  );
}

function recordHttpCompletion(span: Span, status: number): void {
  span.setAttribute("http.status_code", status);
  span.setStatus({
    code: status >= 500 ? SpanStatusCode.ERROR : SpanStatusCode.UNSET,
  });
}

function recordHttpFailure(span: Span, error: unknown, ctx: CrocoHttpContext): void {
  const status = resolveFailureStatus(error);
  ctx.res.status = status;
  span.setAttribute("http.status_code", status);

  if (isProblem(error)) {
    const problem = error;

    span.recordException(toException(problem));
    span.setAttribute("croco.failure.kind", "problem");
    span.setAttribute("croco.problem.code", problem.code);
    span.setAttribute("croco.problem.category", problem.category);
    span.addEvent("croco.problem", {
      "croco.problem.code": problem.code,
      "croco.problem.category": problem.category,
      "http.status_code": status,
    });
    setFailureStatus(span, status, problem.message);
    return;
  }

  if (error instanceof Response) {
    span.setAttribute("croco.failure.kind", "response");
    span.addEvent("croco.http.response.thrown", {
      "http.status_code": status,
    });
    setFailureStatus(span, status);
    return;
  }

  const spanError = error instanceof Error ? error : new Error(String(error));

  span.recordException(toException(spanError));
  span.setAttribute("croco.failure.kind", "error");
  setFailureStatus(span, status, spanError.message);
}

function resolveFailureStatus(error: unknown): number {
  if (error instanceof Response) {
    return error.status;
  }

  if (isProblem(error)) {
    return ProblemCategoryMapper.toHttpStatus(error.category);
  }

  return 500;
}

function isProblem(error: unknown): error is Problem {
  return error instanceof Problem;
}

function toException(error: Error): Exception {
  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
  };
}

function setFailureStatus(span: Span, status: number, message?: string): void {
  if (status >= 500) {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      ...(message ? { message } : {}),
    });
    return;
  }

  span.setStatus({ code: SpanStatusCode.UNSET });
}

function setTelemetryDegradedHeader(ctx: CrocoHttpContext): void {
  try {
    ctx.raw.header(TELEMETRY_DEGRADED_HEADER, TELEMETRY_DEGRADED_REASON);
  } catch {
    // Header emission is best-effort because telemetry setup has already failed.
  }
}

function recordTelemetryDegradation(
  ctx: CrocoHttpContext,
  route: string,
  traceId: string,
  error: unknown,
): void {
  const errorInfo = normalizeSetupError(error);

  ctx.set("telemetryDegradedReason", TELEMETRY_DEGRADED_REASON);
  ctx.set("telemetryDegradedError", errorInfo);

  warnTelemetryDegradation({
    route,
    method: ctx.req.method,
    path: ctx.req.path,
    traceId,
    errorCategory: TELEMETRY_DEGRADED_REASON,
    errorName: errorInfo.name,
    errorMessage: errorInfo.message,
  });
}

function normalizeSetupError(error: unknown): TelemetrySetupErrorInfo {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
    };
  }

  return {
    name: "NonErrorThrown",
    message: String(error),
  };
}

function warnTelemetryDegradation(metadata: TelemetryDegradationMetadata): void {
  const logger = resolveLogger();

  if (logger) {
    try {
      logger.warn(TELEMETRY_DEGRADED_MESSAGE, metadata);
      return;
    } catch (loggerError) {
      console.warn(
        "[TelemetryMiddleware] Failed to write telemetry degradation warning",
        loggerError,
      );
    }
  }

  console.warn(TELEMETRY_DEGRADED_MESSAGE, metadata);
}

function resolveLogger(): ILogger | undefined {
  try {
    if (!Container.has(LOGGER_TOKEN)) {
      return undefined;
    }

    return Container.get(LOGGER_TOKEN);
  } catch {
    return undefined;
  }
}

/**
 * 현재 활성 OpenTelemetry Span을 반환합니다.
 */
export function getCurrentSpan() {
  return trace.getSpan(context.active());
}

/**
 * 현재 활성 Span의 traceId를 반환합니다.
 */
export function getTraceId(): string | undefined {
  const span = getCurrentSpan();
  return span?.spanContext().traceId;
}
