import { ExponentialBackoff, FixedBackoff, NoBackoff } from '@croco/retry-core';
import { describe, expect, it } from 'vitest';
import { toQStashDuration, toQStashRetryOptions } from '../libs/retryAdapter';

describe('retryAdapter', () => {
  describe('toQStashRetryOptions', () => {
    it('should convert maxAttempts to retries', () => {
      const result = toQStashRetryOptions(5);
      expect(result.retries).toBe(4); // 5 attempts - 1 = 4 retries
    });

    it('should handle ExponentialBackoff', () => {
      const backoff = new ExponentialBackoff({ delay: 1000, multiplier: 2 });
      const result = toQStashRetryOptions(3, backoff);
      expect(result.retryDelay).toContain('pow');
      expect(result.retryDelay).toContain('retried');
    });

    it('should handle FixedBackoff', () => {
      const backoff = new FixedBackoff(5000);
      const result = toQStashRetryOptions(3, backoff);
      expect(result.retryDelay).toBe('5000');
    });

    it('should handle NoBackoff', () => {
      const backoff = new NoBackoff();
      const result = toQStashRetryOptions(3, backoff);
      expect(result.retryDelay).toBe('0');
    });
  });

  describe('toQStashDuration', () => {
    it('should convert milliseconds to seconds', () => {
      expect(toQStashDuration(10000)).toBe('10s');
    });

    it('should convert to minutes when appropriate', () => {
      expect(toQStashDuration(120000)).toBe('2m');
    });

    it('should convert to hours when appropriate', () => {
      expect(toQStashDuration(3600000)).toBe('1h');
    });
  });
});
