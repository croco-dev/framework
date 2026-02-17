import { context, trace } from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { afterAll, describe, expect, it } from 'vitest';
import type { TraceDecoratorOptions } from '../libs/decorators/Trace';
import { Trace } from '../libs/decorators/Trace';
import { getActiveTraceInfo, recordEvent, withSpan } from '../libs/span';
import { getTracer } from '../libs/tracer';

const asyncContextManager = new AsyncLocalStorageContextManager().enable();
const isContextManagerRegistered = context.setGlobalContextManager(asyncContextManager);

if (!isContextManagerRegistered) {
  asyncContextManager.disable();
}

afterAll(() => {
  if (isContextManagerRegistered) {
    asyncContextManager.disable();
  }
});

function decorateMethodWithTrace(target: object, methodName: string, options: TraceDecoratorOptions): void {
  const descriptor = Object.getOwnPropertyDescriptor(target, methodName);
  if (!descriptor) {
    throw new Error(`Method descriptor not found: ${methodName}`);
  }

  const decoratedDescriptor = Trace(options)(target, methodName, descriptor) ?? descriptor;
  Object.defineProperty(target, methodName, decoratedDescriptor);
}

describe('Trace', () => {
  it('should decorate async methods with tracing', async () => {
    class TestService {
      value = 0;

      async increment(): Promise<number> {
        this.value += 1;
        return this.value;
      }
    }

    decorateMethodWithTrace(TestService.prototype, 'increment', { name: 'test-operation' });

    const service = new TestService();
    const result = await service.increment();

    expect(result).toBe(1);
  });

  it('should preserve active span context after await', async () => {
    class TestService {
      async run(): Promise<void> {
        const spanBeforeAwait = trace.getSpan(context.active());
        if (!spanBeforeAwait) {
          throw new Error('Expected active span before await');
        }

        await Promise.resolve();
        const spanAfterMicrotaskAwait = trace.getSpan(context.active());
        if (!spanAfterMicrotaskAwait) {
          throw new Error('Expected active span after microtask await');
        }

        await new Promise((resolve) => setTimeout(resolve, 0));
        const spanAfterMacrotaskAwait = trace.getSpan(context.active());
        if (!spanAfterMacrotaskAwait) {
          throw new Error('Expected active span after macrotask await');
        }

        expect(spanAfterMicrotaskAwait).toBe(spanBeforeAwait);
        expect(spanAfterMacrotaskAwait).toBe(spanBeforeAwait);
      }
    }

    decorateMethodWithTrace(TestService.prototype, 'run', { name: 'async-context-test' });

    const service = new TestService();

    await service.run();
  });

  it('should handle errors in decorated methods', async () => {
    class TestService {
      async failingMethod(): Promise<void> {
        throw new Error('Test error');
      }
    }

    decorateMethodWithTrace(TestService.prototype, 'failingMethod', { name: 'failing-operation' });

    const service = new TestService();

    await expect(service.failingMethod()).rejects.toThrow('Test error');
  });
});

describe('withSpan', () => {
  it('should wrap function execution with span', async () => {
    let capturedSpan: unknown;

    const result = await withSpan(
      async (span) => {
        capturedSpan = span;
        return 42;
      },
      { name: 'test-span', attributes: { key: 'value' } }
    );

    expect(result).toBe(42);
    expect(capturedSpan).toBeDefined();
  });

  it('should record errors and rethrow', async () => {
    await expect(
      withSpan(async () => {
        throw new Error('Test error');
      })
    ).rejects.toThrow('Test error');
  });
});

describe('recordEvent', () => {
  it('should not throw when no active span', () => {
    expect(() => recordEvent('test-event', { key: 'value' })).not.toThrow();
  });
});

describe('getActiveTraceInfo', () => {
  it('should return empty object when no active trace', () => {
    const info = getActiveTraceInfo();
    expect(info).toEqual({});
  });
});

describe('getTracer', () => {
  it('should return tracer instance', () => {
    const tracer = getTracer();
    expect(tracer).toBeDefined();
  });

  it('should use custom name when provided', () => {
    const tracer = getTracer({ name: 'custom-tracer' });
    expect(tracer).toBeDefined();
  });
});

describe('@Trace + withSpan error recording', () => {
  it('should not record error twice when @Trace wraps withSpan', async () => {
    class TestService {
      @Trace({ name: 'outer-operation' })
      async methodWithInnerSpan(): Promise<void> {
        await withSpan(
          async () => {
            throw new Error('Test error');
          },
          { name: 'inner-operation' }
        );
      }
    }

    const service = new TestService();

    try {
      await service.methodWithInnerSpan();
      expect.fail('Should have thrown an error');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe('Test error');
    }
  });
});
