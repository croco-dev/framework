import type { CircuitBreakerStateStore } from './CircuitBreakerState';
import { CircuitState, InMemoryCircuitBreakerStateStore, isDistributedStore } from './CircuitBreakerState';
import { CircuitBreakerOpenProblem } from './errors/CircuitBreakerOpenProblem';

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
   * 설정되지 않으면 CircuitBreakerOpenProblem이 발생합니다.
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
 *   if (error instanceof CircuitBreakerOpenProblem) {
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
  private localClosedActiveCount = 0;
  private localHalfOpenActiveCount = 0;
  private localHalfOpenSuccessCount = 0;
  private localLock: Promise<void> = Promise.resolve();

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
   * @throws CircuitBreakerOpenProblem 회로가 OPEN 상태이고 fallback이 없는 경우
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
    const transition = await this.withCircuitLock(async () => {
      const currentState = await this.stateStore.getState(this.circuitId);

      if (currentState === CircuitState.CLOSED) {
        return CircuitState.CLOSED;
      }

      if (currentState === CircuitState.HALF_OPEN) {
        return CircuitState.HALF_OPEN;
      }

      const lastFailureTime = await this.stateStore.getLastFailureTime(this.circuitId);
      if (lastFailureTime === null) {
        return CircuitState.OPEN;
      }

      const now = Date.now();
      const timeSinceFailure = now - lastFailureTime;

      if (timeSinceFailure < this.openDuration) {
        return CircuitState.OPEN;
      }

      await this.setCircuitState(CircuitState.HALF_OPEN);
      return CircuitState.HALF_OPEN;
    });

    if (transition === CircuitState.CLOSED) {
      return this.handleClosed(fn);
    }

    if (transition === CircuitState.HALF_OPEN) {
      return this.handleHalfOpen(fn);
    }

    return this.rejectOpenCircuit<T>();
  }

  private async handleHalfOpen<T>(fn: () => Promise<T>): Promise<T> {
    const canExecute = await this.tryAcquireHalfOpenSlot();
    if (!canExecute) {
      throw new CircuitBreakerOpenProblem(this.circuitId);
    }

    try {
      const result = await fn();

      await this.markHalfOpenSuccess();

      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      await this.markHalfOpenFailure();

      throw err;
    }
  }

  private async handleClosed<T>(fn: () => Promise<T>): Promise<T> {
    const canExecute = await this.tryAcquireClosedExecution();
    if (!canExecute) {
      return this.rejectOpenCircuit<T>();
    }

    try {
      const result = await fn();
      await this.recordClosedSuccess();
      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      await this.recordClosedFailure();
      throw err;
    }
  }

  private async tryAcquireClosedExecution(): Promise<boolean> {
    return this.withCircuitLock(async () => {
      const state = await this.stateStore.getState(this.circuitId);
      if (state !== CircuitState.CLOSED) {
        return false;
      }

      const failureCount = await this.stateStore.getFailureCount(this.circuitId);
      const projectedFailureCount = failureCount + this.localClosedActiveCount;
      if (projectedFailureCount >= this.failureThreshold) {
        return false;
      }

      this.localClosedActiveCount += 1;
      return true;
    });
  }

  private releaseClosedExecutionSlot(): void {
    this.localClosedActiveCount = Math.max(0, this.localClosedActiveCount - 1);
  }

  private async recordClosedSuccess(): Promise<void> {
    await this.withCircuitLock(async () => {
      this.releaseClosedExecutionSlot();

      const state = await this.stateStore.getState(this.circuitId);
      if (state !== CircuitState.CLOSED) {
        return;
      }

      await this.stateStore.resetFailureCount(this.circuitId);
    });
  }

  private async recordClosedFailure(): Promise<void> {
    await this.withCircuitLock(async () => {
      this.releaseClosedExecutionSlot();

      const state = await this.stateStore.getState(this.circuitId);
      if (state !== CircuitState.CLOSED) {
        return;
      }

      const { shouldOpen } = await this.incrementFailureAndCheck();
      if (!shouldOpen) {
        return;
      }

      await this.stateStore.setLastFailureTime(this.circuitId, Date.now());
      await this.setCircuitState(CircuitState.OPEN);
    });
  }

  private async incrementFailureAndCheck(): Promise<{ failureCount: number; shouldOpen: boolean }> {
    if (isDistributedStore(this.stateStore)) {
      return this.stateStore.incrementFailureAndCheck(this.circuitId, this.failureThreshold);
    }

    const failureCount = await this.stateStore.incrementFailureCount(this.circuitId);
    return {
      failureCount,
      shouldOpen: failureCount >= this.failureThreshold,
    };
  }

  private async withCircuitLock<T>(operation: () => Promise<T>): Promise<T> {
    if (isDistributedStore(this.stateStore)) {
      return this.stateStore.withCircuitLock(this.circuitId, operation);
    }

    const previousLock = this.localLock;
    let releaseLock!: () => void;
    this.localLock = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });

    await previousLock;

    try {
      return await operation();
    } finally {
      releaseLock();
    }
  }

  private async tryAcquireHalfOpenSlot(): Promise<boolean> {
    return this.withCircuitLock(async () => {
      const state = await this.stateStore.getState(this.circuitId);
      if (state !== CircuitState.HALF_OPEN) {
        return false;
      }

      const activeCount = await this.getHalfOpenActiveCount();
      if (activeCount >= this.halfOpenRequests) {
        return false;
      }

      await this.setHalfOpenActiveCount(activeCount + 1);
      return true;
    });
  }

  private async markHalfOpenSuccess(): Promise<void> {
    await this.withCircuitLock(async () => {
      const state = await this.stateStore.getState(this.circuitId);
      if (state !== CircuitState.HALF_OPEN) {
        return;
      }

      const activeCount = await this.getHalfOpenActiveCount();
      const nextActiveCount = Math.max(0, activeCount - 1);
      await this.setHalfOpenActiveCount(nextActiveCount);

      const successCount = await this.getHalfOpenSuccessCount();
      const nextSuccessCount = successCount + 1;
      await this.setHalfOpenSuccessCount(nextSuccessCount);

      if (nextSuccessCount >= this.halfOpenRequests) {
        await this.stateStore.resetFailureCount(this.circuitId);
        await this.setCircuitState(CircuitState.CLOSED);
      }
    });
  }

  private async markHalfOpenFailure(): Promise<void> {
    await this.withCircuitLock(async () => {
      const state = await this.stateStore.getState(this.circuitId);
      if (state !== CircuitState.HALF_OPEN) {
        return;
      }

      await this.stateStore.setLastFailureTime(this.circuitId, Date.now());
      await this.setCircuitState(CircuitState.OPEN);
    });
  }

  private async setCircuitState(state: CircuitState): Promise<void> {
    await this.stateStore.setState(this.circuitId, state);
    this.localHalfOpenActiveCount = 0;
    this.localHalfOpenSuccessCount = 0;
  }

  private async getHalfOpenActiveCount(): Promise<number> {
    if (isDistributedStore(this.stateStore)) {
      return this.stateStore.getHalfOpenActiveCount(this.circuitId);
    }

    return this.localHalfOpenActiveCount;
  }

  private async setHalfOpenActiveCount(count: number): Promise<void> {
    const nextCount = Math.max(0, count);

    if (isDistributedStore(this.stateStore)) {
      await this.stateStore.setHalfOpenActiveCount(this.circuitId, nextCount);
      return;
    }

    this.localHalfOpenActiveCount = nextCount;
  }

  private async getHalfOpenSuccessCount(): Promise<number> {
    if (isDistributedStore(this.stateStore)) {
      return this.stateStore.getHalfOpenSuccessCount(this.circuitId);
    }

    return this.localHalfOpenSuccessCount;
  }

  private async setHalfOpenSuccessCount(count: number): Promise<void> {
    const nextCount = Math.max(0, count);

    if (isDistributedStore(this.stateStore)) {
      await this.stateStore.setHalfOpenSuccessCount(this.circuitId, nextCount);
      return;
    }

    this.localHalfOpenSuccessCount = nextCount;
  }

  private async rejectOpenCircuit<T>(): Promise<T> {
    if (this.fallback) {
      return this.fallback<T>();
    }

    throw new CircuitBreakerOpenProblem(this.circuitId);
  }

  /**
   * 회로를 강제로 OPEN 상태로 설정합니다.
   *
   * 유지보수 모드, 의도적인 서비스 차단 등에 사용합니다.
   */
  async forceOpen(): Promise<void> {
    await this.stateStore.setLastFailureTime(this.circuitId, Date.now());
    await this.setCircuitState(CircuitState.OPEN);
  }

  /**
   * 회로를 강제로 CLOSED 상태로 설정합니다.
   *
   * 서비스 복구 후 회로를 다시 열 때 사용합니다.
   */
  async forceClose(): Promise<void> {
    await this.stateStore.resetFailureCount(this.circuitId);
    await this.setCircuitState(CircuitState.CLOSED);
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
