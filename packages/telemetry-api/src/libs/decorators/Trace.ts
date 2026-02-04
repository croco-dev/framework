import type { Attributes } from '@opentelemetry/api';
import type { SpanOptions } from '../span.js';
import { recordError } from '../span.js';

export type TraceDecoratorOptions = {
  name?: string;
  attributes?: Attributes;
};

export function Trace(options: TraceDecoratorOptions = {}): MethodDecorator {
  return (_target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor): PropertyDescriptor => {
    const originalMethod = descriptor.value;

    descriptor.value = async function (this: unknown, ...args: unknown[]): Promise<unknown> {
      const { withSpan } = await import('../span.js');
      const spanOptions: SpanOptions = {
        name: options.name ?? String(propertyKey),
        attributes: options.attributes ?? {},
      };

      return await withSpan(async (span) => {
        try {
          const result = await originalMethod.apply(this, args);
          return result;
        } catch (error) {
          recordError(error, span);
          throw error;
        }
      }, spanOptions);
    };

    return descriptor;
  };
}

/**
 * 메서드의 Trace 옵션을 가져옵니다 (내부용).
 */
export function getTraceOptions(_target: unknown, _propertyKey: string | symbol): TraceDecoratorOptions | undefined {
  return undefined;
}
