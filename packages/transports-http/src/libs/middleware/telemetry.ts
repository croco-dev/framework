import { context, SpanKind, SpanStatusCode, trace } from '@opentelemetry/api';
import type { MiddlewareFunction } from '../types';

interface TraceParent {
  traceId: string;
  spanId: string;
  traceFlags: number;
}

/**
 * W3C traceparent 헤더 파싱
 * Format: traceparent-{version}-{trace-id}-{parent-id}-{trace-flags}
 * Example: 00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01
 */
function parseTraceParent(header: string | null): TraceParent | null {
  if (!header) {
    return null;
  }

  const parts = header.split('-');
  if (parts.length !== 4) {
    return null;
  }

  const [version, traceId, parentId, flags] = parts;

  // Validate version (currently only 00 and 01 are supported)
  if (version !== '00' && version !== '01') {
    return null;
  }

  // Validate traceId (32 hex digits)
  if (!/^[0-9a-f]{32}$/i.test(traceId)) {
    return null;
  }

  // Validate parentId (16 hex digits)
  if (!/^[0-9a-f]{16}$/i.test(parentId)) {
    return null;
  }

  // Validate flags (2 hex digits)
  if (!/^[0-9a-f]{2}$/i.test(flags)) {
    return null;
  }

  return {
    traceId,
    spanId: parentId,
    traceFlags: Number.parseInt(flags, 16),
  };
}

/**
 * OpenTelemetry 미들웨어
 *
 * 각 요청에 대해 root span을 생성하고 W3C traceparent를 파싱합니다.
 * Route 템플릿을 사용하여 높은 카디널리티를 방지합니다.
 */
export const telemetryMiddleware =
  (route: string): MiddlewareFunction =>
  async (ctx, next): Promise<void> => {
    try {
      const tracer = trace.getTracer('croco-http', '0.0.1');

      const traceParentHeader = ctx.header('traceparent');
      const parsedTrace = traceParentHeader ? parseTraceParent(traceParentHeader) : null;

      const attributes = {
        'http.method': ctx.req.method,
        'http.route': route,
        'http.target': ctx.req.path,
        'http.scheme': new URL(ctx.req.url).protocol.replace(':', ''),
        'http.host': new URL(ctx.req.url).host,
        'http.user_agent': ctx.req.headers['user-agent'] ?? '',
        'http.request.header.traceparent': traceParentHeader ?? '',
      };

      const span = tracer.startSpan(
        `HTTP ${ctx.req.method} ${route}`,
        {
          kind: SpanKind.SERVER,
          attributes,
        },
        parsedTrace ? trace.setSpan(context.active(), trace.wrapSpanContext(parsedTrace)) : undefined
      );

      ctx.set('traceId', span.spanContext().traceId);

      return context.with(trace.setSpan(context.active(), span), async () => {
        try {
          await next();

          const status = ctx.res.status;
          span.setStatus({
            code: status >= 400 ? SpanStatusCode.ERROR : SpanStatusCode.UNSET,
          });
          span.setAttribute('http.status_code', status);
        } catch (error) {
          span.recordException(error as Error);
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: (error as Error).message,
          });
          throw error;
        } finally {
          span.end();
        }
      });
    } catch {
      await next();
    }
  };

/**
 * OpenTelemetry Context에서 현재 span 가져오기
 */
export function getCurrentSpan() {
  return trace.getSpan(context.active());
}

/**
 * 현재 traceId 가져오기
 */
export function getTraceId(): string | undefined {
  const span = getCurrentSpan();
  return span?.spanContext().traceId;
}
