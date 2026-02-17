import { type Attributes, context, type Span, SpanStatusCode, trace } from '@opentelemetry/api';
import { getTracer } from '../tracer.js';

export type TraceDecoratorOptions = {
  name?: string;
  attributes?: Attributes;
};

export function Trace(options: TraceDecoratorOptions = {}): MethodDecorator {
  return (_target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor): PropertyDescriptor => {
    const originalMethod = descriptor.value;

    descriptor.value = async function (this: unknown, ...args: unknown[]): Promise<unknown> {
      const span = getTracer().startSpan(options.name ?? String(propertyKey));
      const spanAttributes = options.attributes ?? {};
      const spanContext = trace.setSpan(context.active(), span);

      for (const [key, value] of Object.entries(spanAttributes)) {
        span.setAttribute(key, value as Parameters<Span['setAttribute']>[1]);
      }

      return await context.with(spanContext, async () => {
        try {
          const result = await originalMethod.apply(this, args);
          span.setStatus({ code: SpanStatusCode.OK });
          return result;
        } catch (error) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error instanceof Error ? error.message : String(error),
          });
          throw error;
        } finally {
          span.end();
        }
      });
    };

    return descriptor;
  };
}

export function getTraceOptions(_target: unknown, _propertyKey: string | symbol): TraceDecoratorOptions | undefined {
  return undefined;
}
