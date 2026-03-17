import { describe, expect, it } from 'vitest';
import { CircuitState, InMemoryCircuitBreakerStateStore } from '../libs/CircuitBreakerState';

describe('InMemoryCircuitBreakerStateStore', () => {
  describe('상태 관리', () => {
    it('기본 상태는 CLOSED여야 한다', async () => {
      const store = new InMemoryCircuitBreakerStateStore();
      const state = await store.getState('circuit-1');
      expect(state).toBe(CircuitState.CLOSED);
    });

    it('상태를 설정하고 조회할 수 있어야 한다', async () => {
      const store = new InMemoryCircuitBreakerStateStore();
      await store.setState('circuit-1', CircuitState.OPEN);
      const state = await store.getState('circuit-1');
      expect(state).toBe(CircuitState.OPEN);
    });

    it('다른 회로의 상태는 독립적이어야 한다', async () => {
      const store = new InMemoryCircuitBreakerStateStore();
      await store.setState('circuit-1', CircuitState.OPEN);
      await store.setState('circuit-2', CircuitState.HALF_OPEN);

      expect(await store.getState('circuit-1')).toBe(CircuitState.OPEN);
      expect(await store.getState('circuit-2')).toBe(CircuitState.HALF_OPEN);
    });
  });

  describe('실패 카운트 관리', () => {
    it('기본 실패 카운트는 0이어야 한다', async () => {
      const store = new InMemoryCircuitBreakerStateStore();
      const count = await store.getFailureCount('circuit-1');
      expect(count).toBe(0);
    });

    it('실패 카운트를 증가시킬 수 있어야 한다', async () => {
      const store = new InMemoryCircuitBreakerStateStore();
      const count1 = await store.incrementFailureCount('circuit-1');
      expect(count1).toBe(1);

      const count2 = await store.incrementFailureCount('circuit-1');
      expect(count2).toBe(2);
    });

    it('실패 카운트를 초기화할 수 있어야 한다', async () => {
      const store = new InMemoryCircuitBreakerStateStore();
      await store.incrementFailureCount('circuit-1');
      await store.incrementFailureCount('circuit-1');
      await store.resetFailureCount('circuit-1');

      const count = await store.getFailureCount('circuit-1');
      expect(count).toBe(0);
    });

    it('다른 회로의 실패 카운트는 독립적이어야 한다', async () => {
      const store = new InMemoryCircuitBreakerStateStore();
      await store.incrementFailureCount('circuit-1');
      await store.incrementFailureCount('circuit-1');
      await store.incrementFailureCount('circuit-2');

      expect(await store.getFailureCount('circuit-1')).toBe(2);
      expect(await store.getFailureCount('circuit-2')).toBe(1);
    });
  });

  describe('마지막 실패 시간 관리', () => {
    it('기본 마지막 실패 시간은 null이어야 한다', async () => {
      const store = new InMemoryCircuitBreakerStateStore();
      const time = await store.getLastFailureTime('circuit-1');
      expect(time).toBeNull();
    });

    it('마지막 실패 시간을 설정하고 조회할 수 있어야 한다', async () => {
      const store = new InMemoryCircuitBreakerStateStore();
      const now = Date.now();
      await store.setLastFailureTime('circuit-1', now);

      const time = await store.getLastFailureTime('circuit-1');
      expect(time).toBe(now);
    });

    it('다른 회로의 마지막 실패 시간은 독립적이어야 한다', async () => {
      const store = new InMemoryCircuitBreakerStateStore();
      const now = Date.now();
      await store.setLastFailureTime('circuit-1', now - 1000);
      await store.setLastFailureTime('circuit-2', now);

      expect(await store.getLastFailureTime('circuit-1')).toBe(now - 1000);
      expect(await store.getLastFailureTime('circuit-2')).toBe(now);
    });
  });

  describe('reset', () => {
    it('특정 회로의 상태를 초기화할 수 있어야 한다', async () => {
      const store = new InMemoryCircuitBreakerStateStore();
      await store.setState('circuit-1', CircuitState.OPEN);
      await store.incrementFailureCount('circuit-1');
      await store.setLastFailureTime('circuit-1', Date.now());

      await store.reset('circuit-1');

      expect(await store.getState('circuit-1')).toBe(CircuitState.CLOSED);
      expect(await store.getFailureCount('circuit-1')).toBe(0);
      expect(await store.getLastFailureTime('circuit-1')).toBeNull();
    });

    it('다른 회로의 상태는 영향받지 않아야 한다', async () => {
      const store = new InMemoryCircuitBreakerStateStore();
      await store.setState('circuit-1', CircuitState.OPEN);
      await store.setState('circuit-2', CircuitState.HALF_OPEN);

      await store.reset('circuit-1');

      expect(await store.getState('circuit-1')).toBe(CircuitState.CLOSED);
      expect(await store.getState('circuit-2')).toBe(CircuitState.HALF_OPEN);
    });

    it('모든 회로의 상태를 초기화할 수 있어야 한다', async () => {
      const store = new InMemoryCircuitBreakerStateStore();
      await store.setState('circuit-1', CircuitState.OPEN);
      await store.setState('circuit-2', CircuitState.HALF_OPEN);
      await store.incrementFailureCount('circuit-1');
      await store.incrementFailureCount('circuit-2');

      await store.resetAll();

      expect(await store.getState('circuit-1')).toBe(CircuitState.CLOSED);
      expect(await store.getState('circuit-2')).toBe(CircuitState.CLOSED);
      expect(await store.getFailureCount('circuit-1')).toBe(0);
      expect(await store.getFailureCount('circuit-2')).toBe(0);
    });
  });

  describe('메모리 경계 관리', () => {
    it('maxEntries를 초과하면 가장 오래된 idle 회로를 제거해야 한다', async () => {
      const store = new InMemoryCircuitBreakerStateStore({ maxEntries: 2, idleTtlMs: 60_000 });

      await store.setState('circuit-1', CircuitState.OPEN);
      await store.setState('circuit-2', CircuitState.HALF_OPEN);
      await store.setState('circuit-3', CircuitState.CLOSED);

      expect(await store.getState('circuit-1')).toBe(CircuitState.CLOSED);
      expect(await store.getState('circuit-2')).toBe(CircuitState.HALF_OPEN);
      expect(await store.getState('circuit-3')).toBe(CircuitState.CLOSED);
    });

    it('idle TTL이 지난 회로는 다음 접근 시 정리되어야 한다', async () => {
      const store = new InMemoryCircuitBreakerStateStore({ maxEntries: 10, idleTtlMs: 5 });

      await store.setState('stale-circuit', CircuitState.OPEN);
      await store.incrementFailureCount('stale-circuit');
      await store.setLastFailureTime('stale-circuit', Date.now());

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(await store.getState('fresh-circuit')).toBe(CircuitState.CLOSED);
      expect(await store.getState('stale-circuit')).toBe(CircuitState.CLOSED);
      expect(await store.getFailureCount('stale-circuit')).toBe(0);
      expect(await store.getLastFailureTime('stale-circuit')).toBeNull();
    });

    it('lock이 잡힌 회로는 eviction 대상에서 건너뛰어야 한다', async () => {
      const store = new InMemoryCircuitBreakerStateStore({ maxEntries: 1, idleTtlMs: 60_000 });

      let releaseLock!: () => void;
      const pendingOperation = new Promise<void>((resolve) => {
        releaseLock = resolve;
      });

      const lockPromise = store.withCircuitLock('locked-circuit', async () => {
        await pendingOperation;
      });

      await new Promise((resolve) => setTimeout(resolve, 0));

      await store.setState('new-circuit', CircuitState.OPEN);

      expect(await store.getState('locked-circuit')).toBe(CircuitState.CLOSED);
      expect(await store.getState('new-circuit')).toBe(CircuitState.OPEN);

      releaseLock();
      await lockPromise;
    });
  });
});
