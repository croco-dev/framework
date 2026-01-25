import { describe, expect, it } from 'vitest';
import { NoBackoff } from '../libs/BackoffPolicy';
import { RetryExhaustedException } from '../libs/errors';
import { RetryTemplate } from '../libs/RetryTemplate';

describe('RetryTemplate', () => {
  it('returns result on first success', async () => {
    const template = new RetryTemplate({
      maxAttempts: 3,
      backoffPolicy: new NoBackoff(),
    });

    const result = await template.execute(async () => 'success');

    expect(result).toBe('success');
  });

  it('retries on failure and succeeds', async () => {
    const template = new RetryTemplate({
      maxAttempts: 3,
      backoffPolicy: new NoBackoff(),
    });

    let attempts = 0;
    const result = await template.execute(async () => {
      attempts++;
      if (attempts < 3) throw new Error('fail');
      return 'success';
    });

    expect(result).toBe('success');
    expect(attempts).toBe(3);
  });

  it('throws last error when exhausted', async () => {
    const template = new RetryTemplate({
      maxAttempts: 3,
      backoffPolicy: new NoBackoff(),
    });

    const error = new Error('persistent failure');

    await expect(
      template.execute(async () => {
        throw error;
      })
    ).rejects.toThrow('persistent failure');
  });

  it('wraps error when wrapExhausted is true', async () => {
    const template = new RetryTemplate({
      maxAttempts: 2,
      wrapExhausted: true,
      backoffPolicy: new NoBackoff(),
    });

    await expect(
      template.execute(async () => {
        throw new Error('fail');
      })
    ).rejects.toThrow(RetryExhaustedException);
  });

  it('calls recovery on exhaustion', async () => {
    const template = new RetryTemplate({
      maxAttempts: 2,
      backoffPolicy: new NoBackoff(),
    });

    const result = await template.execute(
      async () => {
        throw new Error('fail');
      },
      async (ctx) => `recovered after ${ctx.attempt} attempts`
    );

    expect(result).toBe('recovered after 2 attempts');
  });

  it('does not retry non-retryable errors', async () => {
    const template = new RetryTemplate({
      maxAttempts: 3,
      backoffPolicy: new NoBackoff(),
    });

    let attempts = 0;

    await expect(
      template.execute(async () => {
        attempts++;
        throw new TypeError('type error');
      })
    ).rejects.toThrow(TypeError);

    expect(attempts).toBe(1); // No retry for TypeError
  });
});
