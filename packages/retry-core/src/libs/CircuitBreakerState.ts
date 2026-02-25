/**
 * Circuit Breaker 상태를 나타내는 열거형.
 *
 * - CLOSED: 정상 상태, 모든 요청 허용
 * - OPEN: 차단 상태, 요청 거부 (fallback 또는 에러)
 * - HALF_OPEN: 테스트 상태, 제한된 요청 허용하여 시스템 복구 확인
 */
export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

/**
 * Circuit Breaker 상태 저장소 인터페이스.
 *
 * 상태 저장소는 Circuit Breaker의 상태, 실패 카운트, 마지막 실패 시간을 저장합니다.
 * 이 인터페이스를 구현하여 InMemory 외에 Redis, DynamoDB 등 다양한 저장소를 지원할 수 있습니다.
 */
export interface CircuitBreakerStateStore {
  /**
   * 현재 회로 상태를 가져옵니다.
   *
   * @param circuitId 회로 식별자
   * @returns 현재 상태 (기본값: CLOSED)
   */
  getState(circuitId: string): Promise<CircuitState>;

  /**
   * 회로 상태를 설정합니다.
   *
   * @param circuitId 회로 식별자
   * @param state 설정할 상태
   */
  setState(circuitId: string, state: CircuitState): Promise<void>;

  /**
   * 현재 실패 카운트를 가져옵니다.
   *
   * @param circuitId 회로 식별자
   * @returns 실패 횟수 (기본값: 0)
   */
  getFailureCount(circuitId: string): Promise<number>;

  /**
   * 실패 카운트를 증가시키고 새 값을 반환합니다.
   *
   * @param circuitId 회로 식별자
   * @returns 증가된 실패 카운트
   */
  incrementFailureCount(circuitId: string): Promise<number>;

  /**
   * 실패 카운트를 초기화합니다.
   *
   * @param circuitId 회로 식별자
   */
  resetFailureCount(circuitId: string): Promise<void>;

  /**
   * 마지막 실패 시간을 가져옵니다.
   *
   * @param circuitId 회로 식별자
   * @returns 타임스탬프 (ms) 또는 null (기본값: null)
   */
  getLastFailureTime(circuitId: string): Promise<number | null>;

  /**
   * 마지막 실패 시간을 설정합니다.
   *
   * @param circuitId 회로 식별자
   * @param time 타임스탬프 (ms)
   */
  setLastFailureTime(circuitId: string, time: number): Promise<void>;

  withCircuitLock<T>(circuitId: string, operation: () => Promise<T>): Promise<T>;

  incrementFailureAndCheck(
    circuitId: string,
    failureThreshold: number
  ): Promise<{ failureCount: number; shouldOpen: boolean }>;

  getHalfOpenActiveCount(circuitId: string): Promise<number>;

  setHalfOpenActiveCount(circuitId: string, count: number): Promise<void>;

  getHalfOpenSuccessCount(circuitId: string): Promise<number>;

  setHalfOpenSuccessCount(circuitId: string, count: number): Promise<void>;

  reset(circuitId: string): Promise<void>;

  resetAll(): Promise<void>;
}

/**
 * @deprecated Use CircuitBreakerStateStore directly.
 * DistributedCircuitBreakerStateStore is now merged into CircuitBreakerStateStore.
 */
export type DistributedCircuitBreakerStateStore = CircuitBreakerStateStore;

/**
 * @deprecated All CircuitBreakerStateStore instances are now distributed-capable.
 * This function always returns true and will be removed in a future version.
 */
export function isDistributedStore(_store: CircuitBreakerStateStore): _store is DistributedCircuitBreakerStateStore {
  return true;
}

/**
 * 인메모리 Circuit Breaker 상태 저장소.
 *
 * Lambda 환경에 최적화된 기본 구현입니다.
 * 여러 Lambda 인스턴스 간에는 상태 공유되지 않습니다.
 * 분산 환경에서는 Redis/DynamoDB 등의 구현체가 필요합니다.
 */
export class InMemoryCircuitBreakerStateStore implements CircuitBreakerStateStore {
  private readonly states = new Map<string, CircuitState>();
  private readonly failures = new Map<string, number>();
  private readonly lastFailures = new Map<string, number>();
  private readonly halfOpenActiveCounts = new Map<string, number>();
  private readonly halfOpenSuccessCounts = new Map<string, number>();
  private readonly locks = new Map<string, Promise<void>>();

  async getState(circuitId: string): Promise<CircuitState> {
    return this.states.get(circuitId) ?? CircuitState.CLOSED;
  }

  async setState(circuitId: string, state: CircuitState): Promise<void> {
    this.states.set(circuitId, state);
    this.halfOpenActiveCounts.set(circuitId, 0);
    this.halfOpenSuccessCounts.set(circuitId, 0);
  }

  async getFailureCount(circuitId: string): Promise<number> {
    return this.failures.get(circuitId) ?? 0;
  }

  async incrementFailureCount(circuitId: string): Promise<number> {
    const current = this.failures.get(circuitId) ?? 0;
    const next = current + 1;
    this.failures.set(circuitId, next);
    return next;
  }

  async resetFailureCount(circuitId: string): Promise<void> {
    this.failures.set(circuitId, 0);
  }

  async incrementFailureAndCheck(
    circuitId: string,
    failureThreshold: number
  ): Promise<{ failureCount: number; shouldOpen: boolean }> {
    const failureCount = await this.incrementFailureCount(circuitId);
    return {
      failureCount,
      shouldOpen: failureCount >= failureThreshold,
    };
  }

  async getLastFailureTime(circuitId: string): Promise<number | null> {
    const time = this.lastFailures.get(circuitId);
    return time ?? null;
  }

  async setLastFailureTime(circuitId: string, time: number): Promise<void> {
    this.lastFailures.set(circuitId, time);
  }

  async getHalfOpenActiveCount(circuitId: string): Promise<number> {
    return this.halfOpenActiveCounts.get(circuitId) ?? 0;
  }

  async setHalfOpenActiveCount(circuitId: string, count: number): Promise<void> {
    this.halfOpenActiveCounts.set(circuitId, Math.max(0, count));
  }

  async getHalfOpenSuccessCount(circuitId: string): Promise<number> {
    return this.halfOpenSuccessCounts.get(circuitId) ?? 0;
  }

  async setHalfOpenSuccessCount(circuitId: string, count: number): Promise<void> {
    this.halfOpenSuccessCounts.set(circuitId, Math.max(0, count));
  }

  async withCircuitLock<T>(circuitId: string, operation: () => Promise<T>): Promise<T> {
    const previousLock = this.locks.get(circuitId) ?? Promise.resolve();
    let releaseCurrentLock!: () => void;

    const currentLock = new Promise<void>((resolve) => {
      releaseCurrentLock = resolve;
    });

    this.locks.set(circuitId, currentLock);

    await previousLock;

    try {
      return await operation();
    } finally {
      releaseCurrentLock();

      if (this.locks.get(circuitId) === currentLock) {
        this.locks.delete(circuitId);
      }
    }
  }

  /**
   * 특정 회로의 모든 상태를 초기화합니다.
   *
   * @param circuitId 회로 식별자
   */
  async reset(circuitId: string): Promise<void> {
    this.states.delete(circuitId);
    this.failures.delete(circuitId);
    this.lastFailures.delete(circuitId);
    this.halfOpenActiveCounts.delete(circuitId);
    this.halfOpenSuccessCounts.delete(circuitId);
    this.locks.delete(circuitId);
  }

  /**
   * 모든 회로의 상태를 초기화합니다.
   */
  async resetAll(): Promise<void> {
    this.states.clear();
    this.failures.clear();
    this.lastFailures.clear();
    this.halfOpenActiveCounts.clear();
    this.halfOpenSuccessCounts.clear();
    this.locks.clear();
  }
}
