import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { NoBackoff } from '../libs/BackoffPolicy';
import { InMemoryCircuitBreakerStateStore } from '../libs/CircuitBreakerState';
import { CircuitBreakerOpenProblem, RetryExhaustedProblem } from '../libs/errors';
import { setLambdaContext } from '../libs/LambdaTimeoutGuard';
import { Recover } from '../libs/Recover';
import { Retryable } from '../libs/Retryable';
import type { RetryPolicy } from '../libs/RetryPolicy';

describe('@Retryable', () => {
  it('retries method and succeeds', async () => {
    let attempts = 0;

    class TestService {
      @Retryable({
        maxAttempts: 3,
        backoffPolicy: new NoBackoff(),
      })
      async doWork(): Promise<string> {
        attempts++;
        if (attempts < 3) throw new Error('fail');
        return 'success';
      }
    }

    const service = new TestService();
    const result = await service.doWork();

    expect(result).toBe('success');
    expect(attempts).toBe(3);
  });

  it('preserves this context', async () => {
    class TestService {
      private value = 'hello';

      @Retryable({
        maxAttempts: 2,
        backoffPolicy: new NoBackoff(),
      })
      async getValue(): Promise<string> {
        return this.value;
      }
    }

    const service = new TestService();
    const result = await service.getValue();

    expect(result).toBe('hello');
  });

  it('calls recover method on exhaustion', async () => {
    class TestService {
      @Retryable({
        maxAttempts: 2,
        backoffPolicy: new NoBackoff(),
        recover: 'handleError',
      })
      async doWork(): Promise<string> {
        throw new Error('always fails');
      }

      async handleError(error: Error, ..._args: unknown[]): Promise<string> {
        return `recovered: ${error.message}`;
      }
    }

    const service = new TestService();
    const result = await service.doWork();

    expect(result).toBe('recovered: always fails');
  });

  it('passes arguments to original method', async () => {
    class TestService {
      @Retryable({
        maxAttempts: 2,
        backoffPolicy: new NoBackoff(),
      })
      async add(a: number, b: number): Promise<number> {
        return a + b;
      }
    }

    const service = new TestService();
    const result = await service.add(2, 3);

    expect(result).toBe(5);
  });

  it('throws original non-retryable error when it occurs on last attempt', async () => {
    class RetryableError extends Error {}
    class NonRetryableError extends Error {}

    const nonRetryableError = new NonRetryableError('non-retryable on last attempt');
    const retryPolicy: RetryPolicy = {
      shouldRetry(error: unknown): boolean {
        return error instanceof RetryableError;
      },
    };

    let attempts = 0;

    class TestService {
      @Retryable({
        maxAttempts: 3,
        wrapExhausted: true,
        backoffPolicy: new NoBackoff(),
        retryPolicy,
      })
      async doWork(): Promise<void> {
        attempts++;

        if (attempts < 3) {
          throw new RetryableError('retryable');
        }

        throw nonRetryableError;
      }
    }

    const service = new TestService();

    await expect(service.doWork()).rejects.toBe(nonRetryableError);
    expect(attempts).toBe(3);
  });

  it('wraps exhausted error in RetryExhaustedProblem when wrapExhausted is true', async () => {
    const originalError = new Error('fail');

    class TestService {
      @Retryable({ maxAttempts: 2, backoffPolicy: new NoBackoff(), wrapExhausted: true })
      async doWork(): Promise<void> {
        throw originalError;
      }
    }

    const service = new TestService();
    await expect(service.doWork()).rejects.toBeInstanceOf(RetryExhaustedProblem);
  });

  it('throws original error when wrapExhausted is false (default)', async () => {
    const originalError = new Error('original');

    class TestService {
      @Retryable({ maxAttempts: 2, backoffPolicy: new NoBackoff() })
      async doWork(): Promise<void> {
        throw originalError;
      }
    }

    const service = new TestService();
    await expect(service.doWork()).rejects.toBe(originalError);
  });

  it('calls listener onError and onSuccess correctly', async () => {
    const onError = vi.fn();
    const onSuccess = vi.fn();
    const errorAttempts: number[] = [];
    const successAttempts: number[] = [];
    let attempts = 0;

    class TestService {
      @Retryable({
        maxAttempts: 3,
        backoffPolicy: new NoBackoff(),
        listeners: [
          {
            onError: (context, error) => {
              errorAttempts.push(context.attempt);
              onError(context, error);
            },
            onSuccess: (context) => {
              successAttempts.push(context.attempt);
              onSuccess(context);
            },
          },
        ],
      })
      async doWork(): Promise<string> {
        attempts++;
        if (attempts < 3) {
          throw new Error(`fail-${attempts}`);
        }

        return 'success';
      }
    }

    const service = new TestService();
    const result = await service.doWork();

    expect(result).toBe('success');
    expect(onError).toHaveBeenCalledTimes(2);
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(errorAttempts).toEqual([1, 2]);
    expect(successAttempts).toEqual([3]);
  });

  it('calls listener onExhausted when retries are exhausted', async () => {
    const onExhausted = vi.fn();

    class TestService {
      @Retryable({
        maxAttempts: 2,
        backoffPolicy: new NoBackoff(),
        listeners: [
          {
            onExhausted,
          },
        ],
      })
      async doWork(): Promise<void> {
        throw new Error('always fail');
      }
    }

    const service = new TestService();

    await expect(service.doWork()).rejects.toThrow('always fail');
    expect(onExhausted).toHaveBeenCalledTimes(1);
  });

  it('creates circuit breaker and throws CircuitBreakerOpenProblem when threshold exceeded', async () => {
    const getStateSpy = vi.spyOn(InMemoryCircuitBreakerStateStore.prototype, 'getState');
    let attempts = 0;

    class TestService {
      @Retryable({
        maxAttempts: 3,
        backoffPolicy: new NoBackoff(),
        circuitBreaker: {
          failureThreshold: 1,
          successThreshold: 1,
          timeout: 1000,
        },
      })
      async doWork(): Promise<void> {
        attempts++;
        throw new Error('fail');
      }
    }

    const service = new TestService();

    try {
      await expect(service.doWork()).rejects.toBeInstanceOf(CircuitBreakerOpenProblem);
      expect(attempts).toBe(1);
      expect(getStateSpy).toHaveBeenCalled();
    } finally {
      getStateSpy.mockRestore();
    }
  });

  it('calls recover only when error matches recover type', async () => {
    class SpecificError extends Error {
      constructor(..._args: unknown[]) {
        super('specific');
      }
    }

    class OtherError extends Error {
      constructor(..._args: unknown[]) {
        super('other');
      }
    }

    class TestService {
      @Retryable({ maxAttempts: 1, backoffPolicy: new NoBackoff() })
      async doWork(useSpecific: boolean): Promise<string> {
        throw useSpecific ? new SpecificError('specific') : new OtherError('other');
      }

      @Recover(SpecificError)
      async handleSpecific(_error: SpecificError): Promise<string> {
        return 'recovered';
      }
    }

    const service = new TestService();

    await expect(service.doWork(true)).resolves.toBe('recovered');
    await expect(service.doWork(false)).rejects.toBeInstanceOf(OtherError);
  });

  it('uses lambdaTimeoutReserveMs when lambda context provided', async () => {
    class TestService {
      @Retryable({
        maxAttempts: 2,
        backoff: { delay: 20, multiplier: 1, jitter: false },
        lambdaTimeoutReserveMs: 50,
      })
      async doWork(): Promise<void> {
        throw new Error('fail');
      }
    }

    const service = new TestService();
    setLambdaContext({
      getRemainingTimeInMillis: () => 60,
    });

    try {
      await expect(service.doWork()).rejects.toThrow('Lambda timeout guard');
    } finally {
      setLambdaContext(null);
    }
  });
});
