import { describe, expect, it, vi } from 'vitest';
import { CircuitBreaker, type CircuitBreakerOptions } from '../libs/CircuitBreaker';
import { CircuitState, InMemoryCircuitBreakerStateStore } from '../libs/CircuitBreakerState';
import { CircuitBreakerOpenException } from '../libs/errors/CircuitBreakerOpenException';

describe('CircuitBreaker', () => {
  const createBreaker = (options: Partial<CircuitBreakerOptions> = {}) => {
    return new CircuitBreaker({
      circuitId: 'test-circuit',
      failureThreshold: 3,
      openDuration: 100,
      halfOpenRequests: 1,
      ...options,
    });
  };

  it('초기 상태는 CLOSED여야 한다', async () => {
    const breaker = createBreaker();
    const state = await breaker.getState();
    expect(state).toBe(CircuitState.CLOSED);
  });

  it('성공 시 상태가 유지되어야 한다', async () => {
    const breaker = createBreaker();
    const fn = vi.fn().mockResolvedValue('success');

    const result = await breaker.execute(fn);

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(await breaker.getState()).toBe(CircuitState.CLOSED);
    expect(await breaker.getFailureCount()).toBe(0);
  });

  it('실패 임계값 도달 시 OPEN으로 전환되어야 한다', async () => {
    const breaker = createBreaker({ failureThreshold: 2 });
    const fn = vi.fn().mockRejectedValue(new Error('fail'));

    await expect(breaker.execute(fn)).rejects.toThrow('fail');
    await expect(breaker.execute(fn)).rejects.toThrow('fail');

    expect(await breaker.getState()).toBe(CircuitState.OPEN);
    expect(await breaker.getFailureCount()).toBe(2);
  });

  it('OPEN 상태에서 요청이 거부되어야 한다', async () => {
    const breaker = createBreaker({ failureThreshold: 1 });
    const fn = vi.fn().mockRejectedValue(new Error('fail'));

    await expect(breaker.execute(fn)).rejects.toThrow('fail');

    expect(await breaker.getState()).toBe(CircuitState.OPEN);

    fn.mockClear();
    fn.mockResolvedValue('success');

    await expect(breaker.execute(fn)).rejects.toThrow(CircuitBreakerOpenException);
    expect(fn).not.toHaveBeenCalled();
  });

  it('OPEN 상태에서 fallback이 호출되어야 한다', async () => {
    const fallbackSpy = vi.fn().mockResolvedValue('fallback');
    const breaker = createBreaker({
      failureThreshold: 1,
      fallback: fallbackSpy,
    });
    const fn = vi.fn().mockRejectedValue(new Error('fail'));

    await expect(breaker.execute(fn)).rejects.toThrow('fail');

    const result = await breaker.execute(fn);
    expect(result).toBe('fallback');
    expect(fallbackSpy).toHaveBeenCalled();
  });

  it('openDuration 후 HALF_OPEN으로 전환되어야 한다', async () => {
    const breaker = createBreaker({ failureThreshold: 1, openDuration: 50 });
    const fn = vi.fn().mockRejectedValue(new Error('fail'));

    await expect(breaker.execute(fn)).rejects.toThrow('fail');
    expect(await breaker.getState()).toBe(CircuitState.OPEN);

    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(await breaker.getState()).toBe(CircuitState.OPEN);

    fn.mockResolvedValue('success');
    const result = await breaker.execute(fn);

    expect(result).toBe('success');
    expect(await breaker.getState()).toBe(CircuitState.CLOSED);
  });

  it('HALF_OPEN에서 성공 시 CLOSED로 복귀해야 한다', async () => {
    const breaker = createBreaker({ failureThreshold: 1, openDuration: 10 });
    const fn = vi.fn().mockRejectedValue(new Error('fail'));

    await expect(breaker.execute(fn)).rejects.toThrow('fail');

    await new Promise((resolve) => setTimeout(resolve, 20));

    fn.mockResolvedValue('success');
    const result = await breaker.execute(fn);

    expect(result).toBe('success');
    expect(await breaker.getState()).toBe(CircuitState.CLOSED);
    expect(await breaker.getFailureCount()).toBe(0);
  });

  it('HALF_OPEN에서 실패 시 OPEN으로 복귀해야 한다', async () => {
    const breaker = createBreaker({ failureThreshold: 1, openDuration: 10 });
    const fn = vi.fn();

    fn.mockRejectedValueOnce(new Error('fail'));
    await expect(breaker.execute(fn)).rejects.toThrow('fail');

    await new Promise((resolve) => setTimeout(resolve, 20));

    fn.mockRejectedValueOnce(new Error('fail again'));
    await expect(breaker.execute(fn)).rejects.toThrow('fail again');

    expect(await breaker.getState()).toBe(CircuitState.OPEN);
  });

  it('forceOpen으로 상태를 강제 설정할 수 있어야 한다', async () => {
    const breaker = createBreaker();
    const fn = vi.fn().mockResolvedValue('success');

    await breaker.forceOpen();

    expect(await breaker.getState()).toBe(CircuitState.OPEN);

    await expect(breaker.execute(fn)).rejects.toThrow(CircuitBreakerOpenException);
  });

  it('forceClose로 상태를 강제 설정할 수 있어야 한다', async () => {
    const breaker = createBreaker({ failureThreshold: 1 });
    const fn = vi.fn().mockRejectedValue(new Error('fail'));

    await expect(breaker.execute(fn)).rejects.toThrow('fail');
    expect(await breaker.getState()).toBe(CircuitState.OPEN);

    await breaker.forceClose();

    expect(await breaker.getState()).toBe(CircuitState.CLOSED);
    expect(await breaker.getFailureCount()).toBe(0);
  });

  it('reset으로 모든 상태를 초기화할 수 있어야 한다', async () => {
    const breaker = createBreaker({ failureThreshold: 1 });
    const fn = vi.fn().mockRejectedValue(new Error('fail'));

    await expect(breaker.execute(fn)).rejects.toThrow('fail');
    expect(await breaker.getState()).toBe(CircuitState.OPEN);
    expect(await breaker.getFailureCount()).toBe(1);
    expect(await breaker.getLastFailureTime()).not.toBeNull();

    await breaker.reset();

    expect(await breaker.getState()).toBe(CircuitState.CLOSED);
    expect(await breaker.getFailureCount()).toBe(0);
    expect(await breaker.getLastFailureTime()).toBeNull();
  });

  it('상태 저장소를 교체할 수 있어야 한다', async () => {
    const customStore = new InMemoryCircuitBreakerStateStore();
    const breaker = createBreaker({ stateStore: customStore });
    const fn = vi.fn().mockResolvedValue('success');

    const result = await breaker.execute(fn);

    expect(result).toBe('success');
    expect(await breaker.getState()).toBe(CircuitState.CLOSED);
  });

  it('다수의 Circuit Breaker가 독립적으로 동작해야 한다', async () => {
    const breaker1 = createBreaker({ circuitId: 'circuit-1', failureThreshold: 1 });
    const breaker2 = createBreaker({ circuitId: 'circuit-2', failureThreshold: 1 });
    const fn1 = vi.fn().mockRejectedValue(new Error('fail1'));
    const fn2 = vi.fn().mockRejectedValue(new Error('fail2'));

    await expect(breaker1.execute(fn1)).rejects.toThrow('fail1');
    await expect(breaker2.execute(fn2)).rejects.toThrow('fail2');

    expect(await breaker1.getState()).toBe(CircuitState.OPEN);
    expect(await breaker2.getState()).toBe(CircuitState.OPEN);
  });

  describe('상태 전환 임계값 경계값', () => {
    it('실패 횟수가 정확히 threshold일 때 OPEN으로 전환되어야 한다', async () => {
      const breaker = createBreaker({ failureThreshold: 3 });
      const fn = vi.fn().mockRejectedValue(new Error('fail'));

      await expect(breaker.execute(fn)).rejects.toThrow('fail');
      expect(await breaker.getState()).toBe(CircuitState.CLOSED);
      expect(await breaker.getFailureCount()).toBe(1);

      await expect(breaker.execute(fn)).rejects.toThrow('fail');
      expect(await breaker.getState()).toBe(CircuitState.CLOSED);
      expect(await breaker.getFailureCount()).toBe(2);

      await expect(breaker.execute(fn)).rejects.toThrow('fail');
      expect(await breaker.getState()).toBe(CircuitState.OPEN);
      expect(await breaker.getFailureCount()).toBe(3);
    });

    it('threshold-1 실패에서는 CLOSED를 유지해야 한다', async () => {
      const breaker = createBreaker({ failureThreshold: 5 });
      const fn = vi.fn().mockRejectedValue(new Error('fail'));

      for (let i = 0; i < 4; i++) {
        await expect(breaker.execute(fn)).rejects.toThrow('fail');
      }

      expect(await breaker.getState()).toBe(CircuitState.CLOSED);
      expect(await breaker.getFailureCount()).toBe(4);
    });

    it('성공 시 failureCount가 초기화되어야 한다', async () => {
      const breaker = createBreaker({ failureThreshold: 3 });
      const failFn = vi.fn().mockRejectedValue(new Error('fail'));
      const successFn = vi.fn().mockResolvedValue('success');

      await expect(breaker.execute(failFn)).rejects.toThrow('fail');
      await expect(breaker.execute(failFn)).rejects.toThrow('fail');
      expect(await breaker.getFailureCount()).toBe(2);

      await breaker.execute(successFn);
      expect(await breaker.getFailureCount()).toBe(0);
      expect(await breaker.getState()).toBe(CircuitState.CLOSED);
    });
  });

  describe('저장소 예외 처리', () => {
    it('getState 실패 시 에러를 전파해야 한다', async () => {
      const mockStore = {
        getState: vi.fn().mockRejectedValue(new Error('Store unavailable')),
        setState: vi.fn(),
        getFailureCount: vi.fn(),
        incrementFailureCount: vi.fn(),
        resetFailureCount: vi.fn(),
        getLastFailureTime: vi.fn(),
        setLastFailureTime: vi.fn(),
      };

      const breaker = new CircuitBreaker({
        circuitId: 'test-circuit',
        stateStore: mockStore,
      });

      await expect(breaker.getState()).rejects.toThrow('Store unavailable');
    });

    it('setState 실패 시 에러를 전파해야 한다', async () => {
      const mockStore = {
        getState: vi.fn().mockResolvedValue(CircuitState.CLOSED),
        setState: vi.fn().mockRejectedValue(new Error('Store write failed')),
        getFailureCount: vi.fn().mockResolvedValue(0),
        incrementFailureCount: vi.fn().mockResolvedValue(1),
        resetFailureCount: vi.fn(),
        getLastFailureTime: vi.fn().mockResolvedValue(null),
        setLastFailureTime: vi.fn().mockResolvedValue(undefined),
      };

      const breaker = new CircuitBreaker({
        circuitId: 'test-circuit',
        failureThreshold: 1,
        stateStore: mockStore,
      });

      const fn = vi.fn().mockRejectedValue(new Error('fail'));

      await expect(breaker.execute(fn)).rejects.toThrow('Store write failed');
    });
  });

  describe('시간 기반 상태 전환 (fake timers)', () => {
    it('openDuration 경과 후 HALF_OPEN으로 전환되어야 한다', async () => {
      vi.useFakeTimers();
      const breaker = createBreaker({ failureThreshold: 1, openDuration: 100 });
      const fn = vi.fn().mockRejectedValue(new Error('fail'));

      await expect(breaker.execute(fn)).rejects.toThrow('fail');
      expect(await breaker.getState()).toBe(CircuitState.OPEN);

      vi.advanceTimersByTime(100);

      expect(await breaker.getState()).toBe(CircuitState.OPEN);

      fn.mockResolvedValue('success');
      const result = await breaker.execute(fn);

      expect(result).toBe('success');
      expect(await breaker.getState()).toBe(CircuitState.CLOSED);

      vi.useRealTimers();
    });

    it('openDuration 미만에서는 OPEN을 유지해야 한다', async () => {
      vi.useFakeTimers();
      const breaker = createBreaker({ failureThreshold: 1, openDuration: 100 });
      const fn = vi.fn().mockRejectedValue(new Error('fail'));

      await expect(breaker.execute(fn)).rejects.toThrow('fail');
      expect(await breaker.getState()).toBe(CircuitState.OPEN);

      vi.advanceTimersByTime(50);

      expect(await breaker.getState()).toBe(CircuitState.OPEN);

      vi.useRealTimers();
    });

    it('HALF_OPEN에서 성공 후 CLOSED로 전환되고 실패 카운트가 초기화되어야 한다', async () => {
      vi.useFakeTimers();
      const breaker = createBreaker({ failureThreshold: 2, openDuration: 50 });
      const fn = vi.fn();

      fn.mockRejectedValueOnce(new Error('fail'));
      await expect(breaker.execute(fn)).rejects.toThrow('fail');
      expect(await breaker.getFailureCount()).toBe(1);

      fn.mockRejectedValueOnce(new Error('fail'));
      await expect(breaker.execute(fn)).rejects.toThrow('fail');
      expect(await breaker.getState()).toBe(CircuitState.OPEN);
      expect(await breaker.getFailureCount()).toBe(2);

      vi.advanceTimersByTime(60);

      fn.mockResolvedValue('success');
      await breaker.execute(fn);

      expect(await breaker.getState()).toBe(CircuitState.CLOSED);
      expect(await breaker.getFailureCount()).toBe(0);

      vi.useRealTimers();
    });
  });
});
