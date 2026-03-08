import { type Attributes, context, type Span, SpanStatusCode, trace } from '@opentelemetry/api';
import { getTracer } from '../tracer.js';

export type TraceDecoratorOptions = {
  name?: string;
  attributes?: Attributes;
};

const traceOptionsStore = new WeakMap<object, Map<string | symbol, TraceDecoratorOptions>>();

function cloneOptions(options: TraceDecoratorOptions): TraceDecoratorOptions {
  return {
    name: options.name,
    attributes: options.attributes ? { ...options.attributes } : undefined,
  };
}

function setTraceOptions(target: object, propertyKey: string | symbol, options: TraceDecoratorOptions): void {
  const existing = traceOptionsStore.get(target);

  if (existing) {
    existing.set(propertyKey, cloneOptions(options));
    return;
  }

  const map = new Map<string | symbol, TraceDecoratorOptions>();
  map.set(propertyKey, cloneOptions(options));
  traceOptionsStore.set(target, map);
}

export function Trace(options: TraceDecoratorOptions = {}): MethodDecorator {
  return (_target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor): PropertyDescriptor => {
    const originalMethod = descriptor.value;

    setTraceOptions(_target, propertyKey, options);

    descriptor.value = async function (this: unknown, ...args: unknown[]): Promise<unknown> {
      const span = getTracer().startSpan(options.name ?? String(propertyKey));
      const spanAttributes = options.attributes ?? {};
      const spanContext = trace.setSpan(context.active(), span);

      for (const [key, value] of Object.entries(spanAttributes)) {
        span.setAttribute(key, value as Parameters<Span['setAttribute']>[1]);
      }

      return await context.with(spanContext, async () => {
        try {
          return await originalMethod.apply(this, args);
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
  if (typeof _target !== 'object' || _target === null) {
    return undefined;
  }

  const target = _target as object;
  const own = traceOptionsStore.get(target)?.get(_propertyKey);
  if (own) {
    return cloneOptions(own);
  }

  const prototype = Object.getPrototypeOf(target);
  if (!prototype || typeof prototype !== 'object') {
    return undefined;
  }

  const inherited = traceOptionsStore.get(prototype as object)?.get(_propertyKey);
  return inherited ? cloneOptions(inherited) : undefined;
}
