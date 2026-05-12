import type { IsrCacheStore } from "../types";

/**
 * Abstract adapter for ISR cache stores.
 * Implements getOrSet delegation pattern; subclasses implement _get/_set/_delete.
 */
export abstract class AbstractCacheStoreAdapter implements IsrCacheStore {
  abstract _get(key: string): Promise<Response | undefined>;

  abstract _set(key: string, value: Response, ttlMs?: number): Promise<void>;

  abstract _delete(key: string): Promise<void>;

  async getOrSet(
    key: string,
    fetcher: () => Promise<Response>,
    options?: { ttlMs?: number },
  ): Promise<Response> {
    const cached = await this._get(key);
    if (cached) {
      return cached.clone();
    }
    const value = await fetcher();
    await this._set(key, value.clone(), options?.ttlMs);
    return value;
  }
}
