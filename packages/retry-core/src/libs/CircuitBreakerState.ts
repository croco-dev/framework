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

export type InMemoryCircuitBreakerStateStoreOptions = {
  maxEntries?: number;
  idleTtlMs?: number;
};

const DEFAULT_MAX_ENTRIES = 1000;
const DEFAULT_IDLE_TTL_MS = 5 * 60 * 1000;

/**
 * Circuit Breaker 상태 저장소 추상 클래스.
 *
 * 상태 저장소는 Circuit Breaker의 상태, 실패 카운트, 마지막 실패 시간을 저장합니다.
 * 이 추상 클래스를 상속하여 InMemory 외에 Redis, DynamoDB 등 다양한 저장소를 지원할 수 있습니다.
 */
export abstract class CircuitBreakerStateStore {
  /**
   * 현재 회로 상태를 가져옵니다.
   *
   * @param circuitId 회로 식별자
   * @returns 현재 상태 (기본값: CLOSED)
   */
  abstract getState(circuitId: string): Promise<CircuitState>;

  /**
   * 회로 상태를 설정합니다.
   *
   * @param circuitId 회로 식별자
   * @param state 설정할 상태
   */
  abstract setState(circuitId: string, state: CircuitState): Promise<void>;

  /**
   * 현재 실패 카운트를 가져옵니다.
   *
   * @param circuitId 회로 식별자
   * @returns 실패 횟수 (기본값: 0)
   */
  abstract getFailureCount(circuitId: string): Promise<number>;

  /**
   * 실패 카운트를 증가시키고 새 값을 반환합니다.
   *
   * @param circuitId 회로 식별자
   * @returns 증가된 실패 카운트
   */
  abstract incrementFailureCount(circuitId: string): Promise<number>;

  /**
   * 실패 카운트를 초기화합니다.
   *
   * @param circuitId 회로 식별자
   */
  abstract resetFailureCount(circuitId: string): Promise<void>;

  /**
   * 마지막 실패 시간을 가져옵니다.
   *
   * @param circuitId 회로 식별자
   * @returns 타임스탬프 (ms) 또는 null (기본값: null)
   */
  abstract getLastFailureTime(circuitId: string): Promise<number | null>;

  /**
   * 마지막 실패 시간을 설정합니다.
   *
   * @param circuitId 회로 식별자
   * @param time 타임스탬프 (ms)
   */
  abstract setLastFailureTime(circuitId: string, time: number): Promise<void>;

  abstract withCircuitLock<T>(circuitId: string, operation: () => Promise<T>): Promise<T>;

  abstract incrementFailureAndCheck(
    circuitId: string,
    failureThreshold: number
  ): Promise<{ failureCount: number; shouldOpen: boolean }>;

  abstract getHalfOpenActiveCount(circuitId: string): Promise<number>;

  abstract setHalfOpenActiveCount(circuitId: string, count: number): Promise<void>;

  abstract getHalfOpenSuccessCount(circuitId: string): Promise<number>;

  abstract setHalfOpenSuccessCount(circuitId: string, count: number): Promise<void>;

  abstract reset(circuitId: string): Promise<void>;

  abstract resetAll(): Promise<void>;
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
export class InMemoryCircuitBreakerStateStore extends CircuitBreakerStateStore {
  private readonly states = new Map<string, CircuitState>();
  private readonly failures = new Map<string, number>();
  private readonly lastFailures = new Map<string, number>();
  private readonly halfOpenActiveCounts = new Map<string, number>();
  private readonly halfOpenSuccessCounts = new Map<string, number>();
  private readonly locks = new Map<string, Promise<void>>();
  private readonly lastAccessed = new Map<string, number>();
  private readonly maxEntries: number;
  private readonly idleTtlMs: number;

  constructor(options: InMemoryCircuitBreakerStateStoreOptions = {}) {
    super();
    this.maxEntries = Math.max(1, options.maxEntries ?? DEFAULT_MAX_ENTRIES);
    this.idleTtlMs = Math.max(0, options.idleTtlMs ?? DEFAULT_IDLE_TTL_MS);
  }

  async getState(circuitId: string): Promise<CircuitState> {
    this.pruneStaleEntries();
    this.touchIfTracked(circuitId);
    return this.states.get(circuitId) ?? CircuitState.CLOSED;
  }

  async setState(circuitId: string, state: CircuitState): Promise<void> {
    this.ensureTracked(circuitId);
    this.states.set(circuitId, state);
    this.halfOpenActiveCounts.set(circuitId, 0);
    this.halfOpenSuccessCounts.set(circuitId, 0);
  }

  async getFailureCount(circuitId: string): Promise<number> {
    this.pruneStaleEntries();
    this.touchIfTracked(circuitId);
    return this.failures.get(circuitId) ?? 0;
  }

  async incrementFailureCount(circuitId: string): Promise<number> {
    this.ensureTracked(circuitId);
    const current = this.failures.get(circuitId) ?? 0;
    const next = current + 1;
    this.failures.set(circuitId, next);
    return next;
  }

  async resetFailureCount(circuitId: string): Promise<void> {
    this.ensureTracked(circuitId);
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
    this.pruneStaleEntries();
    this.touchIfTracked(circuitId);
    const time = this.lastFailures.get(circuitId);
    return time ?? null;
  }

  async setLastFailureTime(circuitId: string, time: number): Promise<void> {
    this.ensureTracked(circuitId);
    this.lastFailures.set(circuitId, time);
  }

  async getHalfOpenActiveCount(circuitId: string): Promise<number> {
    this.pruneStaleEntries();
    this.touchIfTracked(circuitId);
    return this.halfOpenActiveCounts.get(circuitId) ?? 0;
  }

  async setHalfOpenActiveCount(circuitId: string, count: number): Promise<void> {
    this.ensureTracked(circuitId);
    this.halfOpenActiveCounts.set(circuitId, Math.max(0, count));
  }

  async getHalfOpenSuccessCount(circuitId: string): Promise<number> {
    this.pruneStaleEntries();
    this.touchIfTracked(circuitId);
    return this.halfOpenSuccessCounts.get(circuitId) ?? 0;
  }

  async setHalfOpenSuccessCount(circuitId: string, count: number): Promise<void> {
    this.ensureTracked(circuitId);
    this.halfOpenSuccessCounts.set(circuitId, Math.max(0, count));
  }

  async withCircuitLock<T>(circuitId: string, operation: () => Promise<T>): Promise<T> {
    this.ensureTracked(circuitId);
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
    this.lastAccessed.delete(circuitId);
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
    this.lastAccessed.clear();
  }

  private ensureTracked(circuitId: string): void {
    this.pruneStaleEntries();

    if (!this.lastAccessed.has(circuitId)) {
      this.evictOverflow();
    }

    this.lastAccessed.set(circuitId, Date.now());
  }

  private touchIfTracked(circuitId: string): void {
    if (!this.lastAccessed.has(circuitId)) {
      return;
    }

    this.lastAccessed.set(circuitId, Date.now());
  }

  private pruneStaleEntries(): void {
    if (this.idleTtlMs <= 0 || this.lastAccessed.size === 0) {
      return;
    }

    const now = Date.now();

    for (const [circuitId, lastAccessedAt] of this.lastAccessed.entries()) {
      if (now - lastAccessedAt <= this.idleTtlMs) {
        continue;
      }

      if (this.locks.has(circuitId)) {
        continue;
      }

      void this.reset(circuitId);
    }
  }

  private evictOverflow(): void {
    while (this.lastAccessed.size >= this.maxEntries) {
      const oldestCircuitId = this.findOldestEvictableCircuitId();
      if (!oldestCircuitId) {
        return;
      }

      void this.reset(oldestCircuitId);
    }
  }

  private findOldestEvictableCircuitId(): string | null {
    for (const circuitId of this.lastAccessed.keys()) {
      if (this.locks.has(circuitId)) {
        continue;
      }

      return circuitId;
    }

    return null;
  }
}
