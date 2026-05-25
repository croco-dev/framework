import { context, propagation, SpanKind, SpanStatusCode, trace } from "@opentelemetry/api";
import type { MiddlewareFunction } from "../types";

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

      ctx.set("traceId", span.spanContext().traceId);

      return await context.with(trace.setSpan(context.active(), span), async () => {
        try {
          nextCalled = true;
          await next();

          const status = ctx.res.status;
          span.setStatus({
            code: status >= 400 ? SpanStatusCode.ERROR : SpanStatusCode.UNSET,
          });
          span.setAttribute("http.status_code", status);
        } catch (error) {
          ctx.res.status = 500;
          const spanError = error instanceof Error ? error : new Error(String(error));

          span.recordException(spanError);
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: spanError.message,
          });
          throw error;
        } finally {
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

      await next();
    }
  };

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
