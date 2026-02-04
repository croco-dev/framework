import { describe, expect, it } from 'vitest';
import { Trace } from '../libs/decorators/Trace';
import { getActiveTraceInfo, recordEvent, withSpan } from '../libs/span';
import { getTracer } from '../libs/tracer';

describe('Trace', () => {
  it('should decorate async methods with tracing', async () => {
    class TestService {
      value = 0;

      @Trace({ name: 'test-operation' })
      async increment(): Promise<number> {
        this.value += 1;
        return this.value;
      }
    }

    const service = new TestService();
    const result = await service.increment();

    expect(result).toBe(1);
  });

  it('should handle errors in decorated methods', async () => {
    class TestService {
      @Trace({ name: 'failing-operation' })
      async failingMethod(): Promise<void> {
        throw new Error('Test error');
      }
    }

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
