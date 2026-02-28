import { describe, expect, it, vi } from 'vitest';

import { CircuitBreaker } from '../libs/CircuitBreaker';
import { CircuitState } from '../libs/CircuitBreakerState';
import { CircuitBreakerOpenProblem } from '../libs/errors/CircuitBreakerOpenProblem';
import { RedisCircuitBreakerStore } from '../libs/stores/RedisCircuitBreakerStore';

type MockUpstashRedis = {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, opts?: { ex?: number }) => Promise<'OK' | null>;
  incr: (key: string) => Promise<number>;
  del: (key: string) => Promise<number>;
  expire: (key: string, seconds: number) => Promise<number>;
};

function createSharedMockRedis(): { redis: MockUpstashRedis; data: Map<string, string> } {
  const data = new Map<string, string>();

  const redis: MockUpstashRedis = {
    get: vi.fn(async (key: string) => data.get(key) ?? null),
    set: vi.fn(async (key: string, value: string, _opts?: { ex?: number }): Promise<'OK' | null> => {
      data.set(key, value);
      return 'OK';
    }),
    incr: vi.fn(async (key: string) => {
      const current = Number(data.get(key) ?? '0');
      const next = current + 1;
      data.set(key, String(next));
      return next;
    }),
    del: vi.fn(async (key: string) => {
      const existed = data.delete(key);
      return existed ? 1 : 0;
    }),
    expire: vi.fn(async (_key: string, _seconds: number) => 1),
  };

  return { redis, data };
}

function createFailingMockRedis(): MockUpstashRedis {
  return {
    get: vi.fn(async () => {
      throw new Error('redis-down');
    }),
    set: vi.fn(async (_key: string, _value: string, _opts?: { ex?: number }): Promise<'OK' | null> => {
      throw new Error('redis-down');
    }),
    incr: vi.fn(async () => {
      throw new Error('redis-down');
    }),
    del: vi.fn(async () => {
      throw new Error('redis-down');
    }),
    expire: vi.fn(async () => {
      throw new Error('redis-down');
    }),
  };
}

describe('RedisCircuitBreakerStore', () => {
  it('키 포맷은 croco:cb:{name}:state 여야 한다', async () => {
    const { redis } = createSharedMockRedis();
    const store = new RedisCircuitBreakerStore({
      redis: redis as unknown as never,
    });

    await store.setState('my-circuit', CircuitState.OPEN);

    expect(redis.set).toHaveBeenCalledWith('croco:cb:my-circuit:state', CircuitState.OPEN, { ex: 60 });
  });

  it('여러 인스턴스에서 Circuit Breaker 상태가 공유되어야 한다', async () => {
    const { redis } = createSharedMockRedis();

    const storeA = new RedisCircuitBreakerStore({ redis: redis as unknown as never });
    const storeB = new RedisCircuitBreakerStore({ redis: redis as unknown as never });

    const breakerA = new CircuitBreaker({
      circuitId: 'shared-circuit',
      failureThreshold: 1,
      openDuration: 10_000,
      stateStore: storeA,
    });

    const breakerB = new CircuitBreaker({
      circuitId: 'shared-circuit',
      failureThreshold: 1,
      openDuration: 10_000,
      stateStore: storeB,
    });

    await expect(breakerA.execute(async () => Promise.reject(new Error('fail')))).rejects.toThrow('fail');

    await expect(breakerB.execute(async () => 'ok')).rejects.toThrow(CircuitBreakerOpenProblem);
    await expect(breakerB.getState()).resolves.toBe(CircuitState.OPEN);
  });

  it('Redis 오류 발생 시 인메모리로 자동 전환되어야 한다', async () => {
    const redis = createFailingMockRedis();
    const store = new RedisCircuitBreakerStore({
      onStoreError: 'fallback-inmemory',
      redis: redis as unknown as never,
    });

    // 첫 Redis 호출에서 fallback 활성화
    await expect(store.getState('circuit-1')).resolves.toBe(CircuitState.CLOSED);
    expect(redis.get).toHaveBeenCalledTimes(1);

    // fallback 이후에는 Redis를 더 호출하지 않아야 한다
    expect(redis.set).toHaveBeenCalledTimes(0);

    const breaker = new CircuitBreaker({
      circuitId: 'circuit-1',
      failureThreshold: 1,
      openDuration: 10_000,
      stateStore: store,
    });

    // 첫 실행: 실패 → CB OPEN
    await expect(breaker.execute(async () => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    // 두 번째 실행: CB OPEN이므로 CircuitBreakerOpenProblem
    await expect(breaker.execute(async () => 'ok')).rejects.toThrow(CircuitBreakerOpenProblem);
  });
});
