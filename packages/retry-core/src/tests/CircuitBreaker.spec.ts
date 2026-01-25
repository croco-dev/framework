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
});
