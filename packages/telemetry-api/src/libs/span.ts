import { type Attributes, context, type Exception, type Span, SpanStatusCode, trace } from '@opentelemetry/api';
import { getTracer } from './tracer.js';

export type SpanOptions = {
  name?: string;
  attributes?: Attributes;
};

export type TraceInfo = {
  traceId?: string;
  spanId?: string;
  traceFlags?: number;
  isValid?: boolean;
};

/**
 * 함수 실행을 Span으로 감싸고 자동으로 추적합니다.
 * @param fn 실행할 함수
 * @param options Span 옵션
 * @returns 함수 실행 결과
 */
export async function withSpan<T>(fn: (span: Span) => Promise<T> | T, options: SpanOptions = {}): Promise<T> {
  const tracer = getTracer();
  const { name = 'anonymous-operation', attributes = {} } = options;

  return await tracer.startActiveSpan(name, async (span: Span) => {
    try {
      for (const [key, value] of Object.entries(attributes)) {
        span.setAttribute(key, value as Parameters<Span['setAttribute']>[1]);
      }

      return await fn(span);
    } catch (error) {
      recordError(error, span);
      throw error;
    } finally {
      span.end();
    }
  });
}

export function recordEvent(name: string, attributes: Attributes = {}): void {
  const span = trace.getActiveSpan();
  if (!span) {
    return;
  }

  span.addEvent(name, attributes);
}

export function recordError(error: unknown, span?: Span): void {
  const activeSpan = span ?? trace.getActiveSpan();
  if (!activeSpan) {
    return;
  }

  const exception: Exception = {
    message: error instanceof Error ? error.message : String(error),
  };

  if (error instanceof Error) {
    exception.stack = error.stack;
    exception.name = error.name;
  }

  activeSpan.recordException(exception);
  activeSpan.setStatus({
    code: SpanStatusCode.ERROR,
    message: error instanceof Error ? error.message : String(error),
  });
}

export function getActiveTraceInfo(): TraceInfo {
  const spanContext = trace.getSpanContext(context.active());

  if (!spanContext) {
    return {};
  }

  return {
    traceId: spanContext.traceId,
    spanId: spanContext.spanId,
    traceFlags: spanContext.traceFlags,
    isValid: (spanContext.traceFlags & 1) === 1,
  };
}
