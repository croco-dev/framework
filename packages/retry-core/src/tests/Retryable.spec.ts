import { describe, expect, it } from 'vitest';
import { NoBackoff } from '../libs/BackoffPolicy';
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
});
