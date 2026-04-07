import { context, SpanKind, SpanStatusCode, trace } from '@opentelemetry/api';
import type { MiddlewareFunction } from '../types';

export interface TraceParent {
  traceId: string;
  spanId: string;
  traceFlags: number;
}

export function parseTraceParent(header: string | null): TraceParent | null {
  if (!header) {
    return null;
  }

  const parts = header.split('-');
  if (parts.length !== 4) {
    return null;
  }

  const [version, traceId, parentId, flags] = parts;

  if (version !== '00' && version !== '01') {
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

      return await context.with(trace.setSpan(context.active(), span), async () => {
        try {
          await next();

          const status = ctx.res.status;
          span.setStatus({
            code: status >= 400 ? SpanStatusCode.ERROR : SpanStatusCode.UNSET,
          });
          span.setAttribute('http.status_code', status);
        } catch (error) {
          ctx.res.status = 500;
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
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const fallbackTraceId = `telemetry-degraded-${Date.now().toString(36)}`;

      ctx.set('traceId', fallbackTraceId);
      ctx.set('telemetryDegraded', true);

      console.warn('Telemetry middleware failed, proceeding without tracing', {
        route,
        method: ctx.req.method,
        path: ctx.req.path,
        telemetryDegraded: true,
        errorMessage,
      });
      await next();
    }
  };

export function getCurrentSpan() {
  return trace.getSpan(context.active());
}

export function getTraceId(): string | undefined {
  const span = getCurrentSpan();
  return span?.spanContext().traceId;
}
