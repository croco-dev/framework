import type { CircuitBreakerStateStore } from '../CircuitBreakerState';
import { CircuitState, InMemoryCircuitBreakerStateStore } from '../CircuitBreakerState';

type UpstashRedisLike = {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, opts?: { ex?: number }) => Promise<'OK' | null>;
  incr: (key: string) => Promise<number>;
  del: (key: string) => Promise<number>;
  expire: (key: string, seconds: number) => Promise<number>;
};

export type RedisCircuitBreakerStoreOptions = {
  redis: UpstashRedisLike;
  ttlSeconds?: number;
};

export class RedisCircuitBreakerStore implements CircuitBreakerStateStore {
  private readonly redis: UpstashRedisLike;
  private readonly ttlSeconds: number;

  private fallbackStore: InMemoryCircuitBreakerStateStore | null = null;

  constructor(options: RedisCircuitBreakerStoreOptions) {
    this.redis = options.redis;
    this.ttlSeconds = options.ttlSeconds ?? 60;
  }

  async getState(circuitId: string): Promise<CircuitState> {
    if (this.fallbackStore) {
      const state = await this.fallbackStore.getState(circuitId);
      if (state === CircuitState.OPEN) {
        const lastFailureTime = await this.fallbackStore.getLastFailureTime(circuitId);
        return lastFailureTime === null ? CircuitState.CLOSED : state;
      }

      return state;
    }

    try {
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
    } catch {
      const store = this.getOrCreateFallbackStore();
      const state = await store.getState(circuitId);
      if (state === CircuitState.OPEN) {
        const lastFailureTime = await store.getLastFailureTime(circuitId);
        return lastFailureTime === null ? CircuitState.CLOSED : state;
      }

      return state;
    }
  }

  async setState(circuitId: string, state: CircuitState): Promise<void> {
    return this.runOrFallback(
      async () => {
        await this.redis.set(this.key(circuitId, 'state'), state, { ex: this.ttlSeconds });
        await this.redis.set(this.key(circuitId, 'halfOpenActive'), '0', { ex: this.ttlSeconds });
        await this.redis.set(this.key(circuitId, 'halfOpenSuccess'), '0', { ex: this.ttlSeconds });
      },
      (store) => store.setState(circuitId, state)
    );
  }

  async getFailureCount(circuitId: string): Promise<number> {
    return this.runOrFallback(
      async () => {
        const value = await this.redis.get(this.key(circuitId, 'failures'));
        if (value === null) {
          return 0;
        }

        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
      },
      (store) => store.getFailureCount(circuitId)
    );
  }

  async incrementFailureCount(circuitId: string): Promise<number> {
    return this.runOrFallback(
      async () => {
        const key = this.key(circuitId, 'failures');
        const next = await this.redis.incr(key);
        await this.redis.expire(key, this.ttlSeconds);
        return next;
      },
      (store) => store.incrementFailureCount(circuitId)
    );
  }

  async incrementFailureAndCheck(
    circuitId: string,
    failureThreshold: number
  ): Promise<{ failureCount: number; shouldOpen: boolean }> {
    return this.runOrFallback(
      async () => {
        const key = this.key(circuitId, 'failures');
        const failureCount = await this.redis.incr(key);
        await this.redis.expire(key, this.ttlSeconds);

        return {
          failureCount,
          shouldOpen: failureCount >= failureThreshold,
        };
      },
      (store) => store.incrementFailureAndCheck(circuitId, failureThreshold)
    );
  }

  async resetFailureCount(circuitId: string): Promise<void> {
    return this.runOrFallback(
      async () => {
        await this.redis.del(this.key(circuitId, 'failures'));
      },
      (store) => store.resetFailureCount(circuitId)
    );
  }

  async getLastFailureTime(circuitId: string): Promise<number | null> {
    return this.runOrFallback(
      async () => {
        const value = await this.redis.get(this.key(circuitId, 'lastFailureTime'));
        if (value === null) {
          return null;
        }

        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
      },
      (store) => store.getLastFailureTime(circuitId)
    );
  }

  async setLastFailureTime(circuitId: string, time: number): Promise<void> {
    return this.runOrFallback(
      async () => {
        await this.redis.set(this.key(circuitId, 'lastFailureTime'), String(time), { ex: this.ttlSeconds });
      },
      (store) => store.setLastFailureTime(circuitId, time)
    );
  }

  async getHalfOpenActiveCount(circuitId: string): Promise<number> {
    return this.runOrFallback(
      async () => {
        const value = await this.redis.get(this.key(circuitId, 'halfOpenActive'));
        if (value === null) {
          return 0;
        }

        const parsed = Number(value);
        return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
      },
      (store) => store.getHalfOpenActiveCount(circuitId)
    );
  }

  async setHalfOpenActiveCount(circuitId: string, count: number): Promise<void> {
    return this.runOrFallback(
      async () => {
        await this.redis.set(this.key(circuitId, 'halfOpenActive'), String(Math.max(0, count)), {
          ex: this.ttlSeconds,
        });
      },
      (store) => store.setHalfOpenActiveCount(circuitId, count)
    );
  }

  async getHalfOpenSuccessCount(circuitId: string): Promise<number> {
    return this.runOrFallback(
      async () => {
        const value = await this.redis.get(this.key(circuitId, 'halfOpenSuccess'));
        if (value === null) {
          return 0;
        }

        const parsed = Number(value);
        return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
      },
      (store) => store.getHalfOpenSuccessCount(circuitId)
    );
  }

  async setHalfOpenSuccessCount(circuitId: string, count: number): Promise<void> {
    return this.runOrFallback(
      async () => {
        await this.redis.set(this.key(circuitId, 'halfOpenSuccess'), String(Math.max(0, count)), {
          ex: this.ttlSeconds,
        });
      },
      (store) => store.setHalfOpenSuccessCount(circuitId, count)
    );
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

  private async runOrFallback<T>(
    operation: () => Promise<T>,
    fallbackOperation: (store: InMemoryCircuitBreakerStateStore) => Promise<T>
  ): Promise<T> {
    if (this.fallbackStore) {
      return fallbackOperation(this.fallbackStore);
    }

    try {
      return await operation();
    } catch {
      const store = this.getOrCreateFallbackStore();
      return fallbackOperation(store);
    }
  }
}
