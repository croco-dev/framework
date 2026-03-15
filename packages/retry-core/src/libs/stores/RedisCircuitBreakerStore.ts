import { CircuitBreakerStateStore, CircuitState, InMemoryCircuitBreakerStateStore } from '../CircuitBreakerState';

type UpstashRedisLike = {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, opts?: { ex?: number; nx?: boolean }) => Promise<'OK' | null>;
  incr: (key: string) => Promise<number>;
  del: (...keys: string[]) => Promise<number>;
  expire: (key: string, seconds: number) => Promise<number>;
  scan: (cursor: number, opts?: { match?: string; count?: number }) => Promise<[string, string[]]>;
};

export type OnStoreError = 'throw' | 'open' | 'fallback-inmemory';

export type RedisCircuitBreakerStoreOptions = {
  redis: UpstashRedisLike;
  ttlSeconds?: number;
  onStoreError?: OnStoreError;
};

export class RedisCircuitBreakerStore extends CircuitBreakerStateStore {
  private readonly redis: UpstashRedisLike;
  private readonly ttlSeconds: number;
  private readonly onStoreError: OnStoreError;

  private fallbackStore: InMemoryCircuitBreakerStateStore | null = null;
  private hasLoggedFallbackWarning = false;

  constructor(options: RedisCircuitBreakerStoreOptions) {
    super();
    this.redis = options.redis;
    this.ttlSeconds = options.ttlSeconds ?? 60;
    this.onStoreError = options.onStoreError ?? 'throw';
  }

  async getState(circuitId: string): Promise<CircuitState> {
    const fallbackStore = this.getFallbackStoreIfEnabled();
    if (fallbackStore) {
      return this.getStateFromStore(fallbackStore, circuitId);
    }

    return this.runWithStoreErrorHandling(
      circuitId,
      async () => {
        const value = await this.redis.get(this.key(circuitId, 'state'));
        if (value === null) {
          return CircuitState.CLOSED;
        }

        if (value !== CircuitState.CLOSED && value !== CircuitState.OPEN && value !== CircuitState.HALF_OPEN) {
          return CircuitState.CLOSED;
        }

        if (value === CircuitState.OPEN) {
          const lastFailureTimeRaw = await this.redis.get(this.key(circuitId, 'lastFailureTime'));
          return lastFailureTimeRaw === null ? CircuitState.CLOSED : value;
        }

        return value;
      },
      (store) => this.getStateFromStore(store, circuitId),
      async () => CircuitState.OPEN
    );
  }

  async setState(circuitId: string, state: CircuitState): Promise<void> {
    return this.runWithStoreErrorHandling(
      circuitId,
      async () => {
        await this.redis.set(this.key(circuitId, 'state'), state, { ex: this.ttlSeconds });
        await this.redis.set(this.key(circuitId, 'halfOpenActive'), '0', { ex: this.ttlSeconds });
        await this.redis.set(this.key(circuitId, 'halfOpenSuccess'), '0', { ex: this.ttlSeconds });
      },
      (store) => store.setState(circuitId, state),
      async () => undefined
    );
  }

  async getFailureCount(circuitId: string): Promise<number> {
    return this.runWithStoreErrorHandling(
      circuitId,
      async () => {
        const value = await this.redis.get(this.key(circuitId, 'failures'));
        if (value === null) {
          return 0;
        }

        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
      },
      (store) => store.getFailureCount(circuitId),
      (store) => store.getFailureCount(circuitId)
    );
  }

  async incrementFailureCount(circuitId: string): Promise<number> {
    return this.runWithStoreErrorHandling(
      circuitId,
      async () => {
        const key = this.key(circuitId, 'failures');
        const next = await this.redis.incr(key);
        await this.redis.expire(key, this.ttlSeconds);
        return next;
      },
      (store) => store.incrementFailureCount(circuitId),
      (store) => store.incrementFailureCount(circuitId)
    );
  }

  async incrementFailureAndCheck(
    circuitId: string,
    failureThreshold: number
  ): Promise<{ failureCount: number; shouldOpen: boolean }> {
    return this.runWithStoreErrorHandling(
      circuitId,
      async () => {
        const key = this.key(circuitId, 'failures');
        const failureCount = await this.redis.incr(key);
        await this.redis.expire(key, this.ttlSeconds);

        return {
          failureCount,
          shouldOpen: failureCount >= failureThreshold,
        };
      },
      (store) => store.incrementFailureAndCheck(circuitId, failureThreshold),
      async () => ({
        failureCount: failureThreshold,
        shouldOpen: true,
      })
    );
  }

  async resetFailureCount(circuitId: string): Promise<void> {
    return this.runWithStoreErrorHandling(
      circuitId,
      async () => {
        await this.redis.del(this.key(circuitId, 'failures'));
      },
      (store) => store.resetFailureCount(circuitId),
      async () => undefined
    );
  }

  async getLastFailureTime(circuitId: string): Promise<number | null> {
    return this.runWithStoreErrorHandling(
      circuitId,
      async () => {
        const value = await this.redis.get(this.key(circuitId, 'lastFailureTime'));
        if (value === null) {
          return null;
        }

        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
      },
      (store) => store.getLastFailureTime(circuitId),
      (store) => store.getLastFailureTime(circuitId)
    );
  }

  async setLastFailureTime(circuitId: string, time: number): Promise<void> {
    return this.runWithStoreErrorHandling(
      circuitId,
      async () => {
        await this.redis.set(this.key(circuitId, 'lastFailureTime'), String(time), { ex: this.ttlSeconds });
      },
      (store) => store.setLastFailureTime(circuitId, time),
      async () => undefined
    );
  }

  async getHalfOpenActiveCount(circuitId: string): Promise<number> {
    return this.runWithStoreErrorHandling(
      circuitId,
      async () => {
        const value = await this.redis.get(this.key(circuitId, 'halfOpenActive'));
        if (value === null) {
          return 0;
        }

        const parsed = Number(value);
        return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
      },
      (store) => store.getHalfOpenActiveCount(circuitId),
      (store) => store.getHalfOpenActiveCount(circuitId)
    );
  }

  async setHalfOpenActiveCount(circuitId: string, count: number): Promise<void> {
    return this.runWithStoreErrorHandling(
      circuitId,
      async () => {
        await this.redis.set(this.key(circuitId, 'halfOpenActive'), String(Math.max(0, count)), {
          ex: this.ttlSeconds,
        });
      },
      (store) => store.setHalfOpenActiveCount(circuitId, count),
      async () => undefined
    );
  }

  async getHalfOpenSuccessCount(circuitId: string): Promise<number> {
    return this.runWithStoreErrorHandling(
      circuitId,
      async () => {
        const value = await this.redis.get(this.key(circuitId, 'halfOpenSuccess'));
        if (value === null) {
          return 0;
        }

        const parsed = Number(value);
        return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
      },
      (store) => store.getHalfOpenSuccessCount(circuitId),
      (store) => store.getHalfOpenSuccessCount(circuitId)
    );
  }

  async setHalfOpenSuccessCount(circuitId: string, count: number): Promise<void> {
    return this.runWithStoreErrorHandling(
      circuitId,
      async () => {
        await this.redis.set(this.key(circuitId, 'halfOpenSuccess'), String(Math.max(0, count)), {
          ex: this.ttlSeconds,
        });
      },
      (store) => store.setHalfOpenSuccessCount(circuitId, count),
      async () => undefined
    );
  }

  async reset(circuitId: string): Promise<void> {
    const suffixes = ['state', 'failures', 'lastFailureTime', 'halfOpenActive', 'halfOpenSuccess', 'lock'];
    await this.redis.del(...suffixes.map((suffix) => this.key(circuitId, suffix)));

    if (this.fallbackStore) {
      await this.fallbackStore.reset(circuitId);
    }
  }

  async resetAll(): Promise<void> {
    let cursor = 0;

    do {
      const [nextCursor, keys] = await this.redis.scan(cursor, { match: 'croco:cb:*', count: 100 });
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }

      cursor = Number(nextCursor);
    } while (cursor !== 0);

    if (this.fallbackStore) {
      await this.fallbackStore.resetAll();
    }
  }

  async withCircuitLock<T>(circuitId: string, operation: () => Promise<T>): Promise<T> {
    const fallbackStore = this.getFallbackStoreIfEnabled();
    if (fallbackStore) {
      return fallbackStore.withCircuitLock(circuitId, operation);
    }

    const lockKey = this.key(circuitId, 'lock');

    let acquired: 'OK' | null;
    try {
      acquired = await this.redis.set(lockKey, '1', { nx: true, ex: 10 });
    } catch (error) {
      return this.handleStoreError(
        circuitId,
        error,
        (store) => store.withCircuitLock(circuitId, operation),
        (store) => store.withCircuitLock(circuitId, operation)
      );
    }

    if (!acquired) {
      throw new Error(`Failed to acquire circuit breaker lock for ${circuitId}`);
    }

    try {
      return await operation();
    } finally {
      try {
        await this.redis.del(lockKey);
      } catch (error) {
        await this.handleStoreErrorWithoutResult(circuitId, error);
      }
    }
  }

  private async getStateFromStore(store: InMemoryCircuitBreakerStateStore, circuitId: string): Promise<CircuitState> {
    const state = await store.getState(circuitId);
    if (state === CircuitState.OPEN) {
      const lastFailureTime = await store.getLastFailureTime(circuitId);
      return lastFailureTime === null ? CircuitState.CLOSED : state;
    }

    return state;
  }

  private getFallbackStoreIfEnabled(): InMemoryCircuitBreakerStateStore | null {
    if (this.onStoreError !== 'fallback-inmemory') {
      return null;
    }

    return this.fallbackStore;
  }

  private key(circuitId: string, suffix: string): string {
    return `croco:cb:${circuitId}:${suffix}`;
  }

  private getOrCreateFallbackStore(): InMemoryCircuitBreakerStateStore {
    if (this.fallbackStore) {
      return this.fallbackStore;
    }

    const store = new InMemoryCircuitBreakerStateStore();
    this.fallbackStore = store;
    return store;
  }

  private async markCircuitOpen(store: InMemoryCircuitBreakerStateStore, circuitId: string): Promise<void> {
    await store.setLastFailureTime(circuitId, Date.now());
    await store.setState(circuitId, CircuitState.OPEN);
  }

  private logFallbackWarning(error: unknown): void {
    if (this.hasLoggedFallbackWarning) {
      return;
    }

    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[RedisCircuitBreakerStore] Redis store error. Falling back to in-memory state store: ${message}`);
    this.hasLoggedFallbackWarning = true;
  }

  private normalizeError(error: unknown): Error {
    return error instanceof Error ? error : new Error(String(error));
  }

  private async runWithStoreErrorHandling<T>(
    circuitId: string,
    operation: () => Promise<T>,
    fallbackOperation: (store: InMemoryCircuitBreakerStateStore) => Promise<T>,
    openOperation: (store: InMemoryCircuitBreakerStateStore) => Promise<T>
  ): Promise<T> {
    const fallbackStore = this.getFallbackStoreIfEnabled();
    if (fallbackStore) {
      return fallbackOperation(fallbackStore);
    }

    try {
      return await operation();
    } catch (error) {
      return this.handleStoreError(circuitId, error, fallbackOperation, openOperation);
    }
  }

  private async handleStoreError<T>(
    circuitId: string,
    error: unknown,
    fallbackOperation: (store: InMemoryCircuitBreakerStateStore) => Promise<T>,
    openOperation: (store: InMemoryCircuitBreakerStateStore) => Promise<T>
  ): Promise<T> {
    if (this.onStoreError === 'fallback-inmemory') {
      const store = this.getOrCreateFallbackStore();
      this.logFallbackWarning(error);
      return fallbackOperation(store);
    }

    if (this.onStoreError === 'open') {
      const store = this.getOrCreateFallbackStore();
      await this.markCircuitOpen(store, circuitId);
      return openOperation(store);
    }

    throw this.normalizeError(error);
  }

  private async handleStoreErrorWithoutResult(circuitId: string, error: unknown): Promise<void> {
    if (this.onStoreError === 'fallback-inmemory') {
      this.getOrCreateFallbackStore();
      this.logFallbackWarning(error);
      return;
    }

    if (this.onStoreError === 'open') {
      const store = this.getOrCreateFallbackStore();
      await this.markCircuitOpen(store, circuitId);
      return;
    }

    throw this.normalizeError(error);
  }
}
