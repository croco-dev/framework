import type { CircuitBreakerStateStore } from './CircuitBreakerState';
import { CircuitState, InMemoryCircuitBreakerStateStore } from './CircuitBreakerState';
import { CircuitBreakerOpenException } from './errors/CircuitBreakerOpenException';

/**
 * Circuit Breaker 옵션.
 */
export interface CircuitBreakerOptions {
  /**
   * Circuit 식별자.
   * 여러 Circuit Breaker 인스턴스를 구분하는 데 사용됩니다.
   */
  circuitId: string;

  /**
   * OPEN으로 전환되는 실패 임계값.
   * 이 횟수만큼 실패가 누적되면 회로가 열립니다.
   * @default 5
   */
  failureThreshold?: number;

  /**
   * OPEN 상태 유지 시간 (밀리초).
   * 이 시간이 지난 후 HALF_OPEN 상태로 전환하여 시스템 복구를 확인합니다.
   * @default 30000 (30초)
   */
  openDuration?: number;

  /**
   * HALF_OPEN에서 허용할 테스트 요청 수.
   * 이 횟수만큼 요청이 성공하면 CLOSED 상태로 복귀합니다.
   * @default 1
   */
  halfOpenRequests?: number;

  /**
   * 상태 저장소.
   * 기본적으로 InMemoryCircuitBreakerStateStore가 사용됩니다.
   * Redis, DynamoDB 등의 다른 구현체로 교체 가능합니다.
   */
  stateStore?: CircuitBreakerStateStore;

  /**
   * OPEN 시 호출할 fallback 함수.
   * 설정되지 않으면 CircuitBreakerOpenException이 발생합니다.
   */
  fallback?: <T>() => T | Promise<T>;
}

/**
 * Circuit Breaker 구현.
 *
 * 실패 누적에 따라 요청을 차단하여 시스템 과부하를 방지합니다.
 *
 * @example
 * ```typescript
 * const breaker = new CircuitBreaker({
 *   circuitId: 'api-service',
 *   failureThreshold: 5,
 *   openDuration: 60000,
 * });
 *
 * try {
 *   const result = await breaker.execute(async () => {
 *     return await fetchApi();
 *   });
 * } catch (error) {
 *   if (error instanceof CircuitBreakerOpenException) {
 *     // 회로가 열려서 요청이 차단됨
 *   }
 * }
 * ```
 */
export class CircuitBreaker {
  private readonly circuitId: string;
  private readonly failureThreshold: number;
  private readonly openDuration: number;
  private readonly halfOpenRequests: number;
  private readonly stateStore: CircuitBreakerStateStore;
  private readonly fallback?: <T>() => T | Promise<T>;

  constructor(options: CircuitBreakerOptions) {
    this.circuitId = options.circuitId;
    this.failureThreshold = options.failureThreshold ?? 5;
    this.openDuration = options.openDuration ?? 30000;
    this.halfOpenRequests = options.halfOpenRequests ?? 1;
    this.stateStore = options.stateStore ?? new InMemoryCircuitBreakerStateStore();
    this.fallback = options.fallback;
  }

  /**
   * 작업을 Circuit Breaker로 보호하며 실행합니다.
   *
   * @param fn 실행할 작업
   * @returns 작업 결과
   * @throws CircuitBreakerOpenException 회로가 OPEN 상태이고 fallback이 없는 경우
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const state = await this.stateStore.getState(this.circuitId);

    switch (state) {
      case CircuitState.OPEN:
        return this.handleOpen<T>(fn);
      case CircuitState.HALF_OPEN:
        return this.handleHalfOpen<T>(fn);
      case CircuitState.CLOSED:
        return this.handleClosed<T>(fn);
      default: {
        const exhaustive: never = state;
        throw new Error(`Unexpected state: ${exhaustive}`);
      }
    }
  }

  private async handleOpen<T>(fn: () => Promise<T>): Promise<T> {
    const lastFailureTime = await this.stateStore.getLastFailureTime(this.circuitId);

    if (lastFailureTime !== null) {
      const now = Date.now();
      const timeSinceFailure = now - lastFailureTime;

      if (timeSinceFailure >= this.openDuration) {
        await this.stateStore.setState(this.circuitId, CircuitState.HALF_OPEN);
        return this.execute(fn);
      }
    }

    if (this.fallback) {
      return this.fallback<T>();
    }

    throw new CircuitBreakerOpenException(this.circuitId);
  }

  private async handleHalfOpen<T>(fn: () => Promise<T>): Promise<T> {
    try {
      const result = await fn();

      await this.stateStore.resetFailureCount(this.circuitId);
      await this.stateStore.setState(this.circuitId, CircuitState.CLOSED);

      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      await this.stateStore.setLastFailureTime(this.circuitId, Date.now());
      await this.stateStore.setState(this.circuitId, CircuitState.OPEN);

      throw err;
    }
  }

  private async handleClosed<T>(fn: () => Promise<T>): Promise<T> {
    try {
      const result = await fn();
      await this.stateStore.resetFailureCount(this.circuitId);
      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      const failureCount = await this.stateStore.incrementFailureCount(this.circuitId);

      if (failureCount >= this.failureThreshold) {
        await this.stateStore.setLastFailureTime(this.circuitId, Date.now());
        await this.stateStore.setState(this.circuitId, CircuitState.OPEN);
      }

      throw err;
    }
  }

  /**
   * 회로를 강제로 OPEN 상태로 설정합니다.
   *
   * 유지보수 모드, 의도적인 서비스 차단 등에 사용합니다.
   */
  async forceOpen(): Promise<void> {
    await this.stateStore.setLastFailureTime(this.circuitId, Date.now());
    await this.stateStore.setState(this.circuitId, CircuitState.OPEN);
  }

  /**
   * 회로를 강제로 CLOSED 상태로 설정합니다.
   *
   * 서비스 복구 후 회로를 다시 열 때 사용합니다.
   */
  async forceClose(): Promise<void> {
    await this.stateStore.resetFailureCount(this.circuitId);
    await this.stateStore.setState(this.circuitId, CircuitState.CLOSED);
  }

  /**
   * 회로의 모든 상태를 초기화합니다.
   *
   * 실패 카운트, 마지막 실패 시간, 상태가 모두 초기화됩니다.
   * 참고: InMemoryCircuitBreakerStateStore 사용 시에만 지원됩니다.
   */
  async reset(): Promise<void> {
    const store = this.stateStore;
    if ('reset' in store && typeof store.reset === 'function') {
      await store.reset(this.circuitId);
    } else {
      await this.forceClose();
    }
  }

  /**
   * 현재 회로 상태를 반환합니다.
   */
  async getState(): Promise<CircuitState> {
    return this.stateStore.getState(this.circuitId);
  }

  /**
   * 현재 실패 카운트를 반환합니다.
   */
  async getFailureCount(): Promise<number> {
    return this.stateStore.getFailureCount(this.circuitId);
  }

  /**
   * 마지막 실패 시간을 반환합니다.
   */
  async getLastFailureTime(): Promise<number | null> {
    return this.stateStore.getLastFailureTime(this.circuitId);
  }
}
