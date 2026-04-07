import { CacheStore } from './CacheStore';

export type DistributedCacheLock = {
  release(): Promise<void>;
};

export type DistributedCacheSetOptions = {
  ttlMs?: number;
};

export abstract class DistributedCacheStore<K extends string = string, V = unknown> extends CacheStore<K, V> {
  abstract acquireLock(key: K, ttlMs: number): Promise<DistributedCacheLock | undefined>;

  abstract publishInvalidation(pattern: string): Promise<void>;
}
