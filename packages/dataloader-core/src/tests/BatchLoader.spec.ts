import { Context } from '@croco/framework-context';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBatchLoader } from '../libs/createBatchLoader';
import type { BatchFn } from '../libs/types';

describe('BatchLoader', () => {
  const batchFn = vi.fn<BatchFn<number, string>>(async (keys) => {
    return keys.map((key) => {
      if (key === -1) return new Error('Error for -1');
      if (key === 0) return null;
      return `Value: ${key}`;
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should batch requests in the same tick', async () => {
    await Context.run({ requestId: 'test' }, async () => {
      const loader = createBatchLoader({
        name: 'test-loader',
        batchFn: batchFn,
      });

      const p1 = loader.load(1);
      const p2 = loader.load(2);
      const p3 = loader.load(3);

      const results = await Promise.all([p1, p2, p3]);

      expect(results).toEqual(['Value: 1', 'Value: 2', 'Value: 3']);
      expect(batchFn).toHaveBeenCalledTimes(1);
      expect(batchFn).toHaveBeenCalledWith([1, 2, 3]);
    });
  });

  it('should cache results within the same context', async () => {
    await Context.run({ requestId: 'test' }, async () => {
      const loader = createBatchLoader({
        name: 'test-loader',
        batchFn: batchFn,
      });

      await loader.load(1);
      await loader.load(1);

      expect(batchFn).toHaveBeenCalledTimes(1);
    });
  });

  it('should not cache results across different contexts', async () => {
    await Context.run({ requestId: 'req1' }, async () => {
      const loader = createBatchLoader({
        name: 'test-loader',
        batchFn: batchFn,
      });
      await loader.load(1);
    });

    await Context.run({ requestId: 'req2' }, async () => {
      const loader = createBatchLoader({
        name: 'test-loader',
        batchFn: batchFn,
      });
      await loader.load(1);
    });

    expect(batchFn).toHaveBeenCalledTimes(2);
  });

  it('should handle errors correctly', async () => {
    await Context.run({ requestId: 'test' }, async () => {
      const loader = createBatchLoader({
        name: 'test-loader',
        batchFn: batchFn,
      });

      await expect(loader.load(-1)).rejects.toThrow('Error for -1');

      const [r1, r2] = await Promise.allSettled([loader.load(1), loader.load(-1)]);

      expect(r1.status).toBe('fulfilled');

      expect(r2.status).toBe('rejected');
    });
  });

  it('should handle maxBatchSize', async () => {
    await Context.run({ requestId: 'test' }, async () => {
      const loader = createBatchLoader({
        name: 'test-loader',
        batchFn: batchFn,
        maxBatchSize: 2,
      });

      const p1 = loader.load(1);
      const p2 = loader.load(2);
      const p3 = loader.load(3);

      await Promise.all([p1, p2, p3]);

      expect(batchFn).toHaveBeenCalledTimes(2);
      expect(batchFn).toHaveBeenCalledWith([1, 2]);
      expect(batchFn).toHaveBeenCalledWith([3]);
    });
  });

  it('should work without cache when disabled', async () => {
    await Context.run({ requestId: 'test' }, async () => {
      const loader = createBatchLoader({
        name: 'test-loader',
        batchFn: batchFn,
        cache: false,
      });

      await loader.load(1);
      await loader.load(1);

      expect(batchFn).toHaveBeenCalledTimes(2);
    });
  });

  it('should not cache errors', async () => {
    await Context.run({ requestId: 'test-error-cache' }, async () => {
      const fn = vi.fn(async (keys: number[]) => keys.map((_k) => new Error('fail')));
      const loader = createBatchLoader({ name: 'error-loader', batchFn: fn });

      await expect(loader.load(1)).rejects.toThrow('fail');
      await expect(loader.load(1)).rejects.toThrow('fail');

      expect(fn).toHaveBeenCalledTimes(2);
    });
  });
});
