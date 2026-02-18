import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Dataloader } from '../libs/Dataloader';

type BatchLoadFnType<K, V> = (keys: K[]) => Promise<V[]>;

describe('Dataloader', () => {
  let dataloader!: Dataloader<string, number>;
  let batchFn!: BatchLoadFnType<string, number>;

  beforeEach(() => {
    batchFn = vi.fn(async (keys: string[]) => keys.map((key) => parseInt(key, 10)));
    dataloader = new Dataloader(batchFn);
  });

  describe('batching', () => {
    it('should batch multiple load calls into single batch function call', async () => {
      const promises = [dataloader.load('1'), dataloader.load('2'), dataloader.load('3')];

      const results = await Promise.all(promises);

      expect(results).toEqual([1, 2, 3]);
      expect(batchFn).toHaveBeenCalledTimes(1);
      expect(batchFn).toHaveBeenCalledWith(['1', '2', '3']);
    });

    it('should deduplicate keys in same batch', async () => {
      const promises = [dataloader.load('1'), dataloader.load('1'), dataloader.load('2')];

      const results = await Promise.all(promises);

      expect(results).toEqual([1, 1, 2]);
      expect(batchFn).toHaveBeenCalledTimes(1);
      expect(batchFn).toHaveBeenCalledWith(['1', '2']);
    });
  });

  describe('caching', () => {
    it('should cache results for subsequent load calls', async () => {
      const result1 = await dataloader.load('42');
      const result2 = await dataloader.load('42');

      expect(result1).toBe(42);
      expect(result2).toBe(42);
      expect(batchFn).toHaveBeenCalledTimes(1);
    });

    it('should clear cached value', async () => {
      await dataloader.load('42');
      dataloader.clear('42');

      await dataloader.load('42');

      expect(batchFn).toHaveBeenCalledTimes(2);
    });

    it('should clear all cached values', async () => {
      await dataloader.load('1');
      await dataloader.load('2');
      dataloader.clearAll();

      await dataloader.load('1');
      await dataloader.load('2');

      expect(batchFn).toHaveBeenCalledTimes(4);
    });

    it('should prime cache with value', async () => {
      dataloader.prime('100', 999);

      const result = await dataloader.load('100');

      expect(result).toBe(999);
      expect(batchFn).not.toHaveBeenCalled();
    });

    it('should not overwrite existing cache with prime', async () => {
      await dataloader.load('42');
      dataloader.prime('42', 999);

      const result = await dataloader.load('42');

      expect(result).toBe(42);
    });
  });

  describe('error handling', () => {
    it('should reject all pending loads when batch function throws', async () => {
      const errorLoader = new Dataloader<string, number>(async () => {
        throw new Error('Batch failed');
      });

      await expect(errorLoader.load('1')).rejects.toThrow('Batch failed');
    });

    it('should reject when batch returns wrong number of values', async () => {
      const badLoader = new Dataloader<string, number>(async (keys) => {
        return keys.slice(0, 1).map((k) => parseInt(k, 10));
      });

      const promises = [badLoader.load('1'), badLoader.load('2')];
      await expect(Promise.all(promises)).rejects.toThrow('must return array of same length');
    });

    it('should reject when value is undefined for key', async () => {
      const partialLoader = new Dataloader<string, number | undefined>(async () => [undefined]);

      await expect(partialLoader.load('missing')).rejects.toThrow('No value returned for key');
    });
  });
});
