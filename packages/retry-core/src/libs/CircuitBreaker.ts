import {
  type CircuitBreakerStateStore,
  CircuitState,
  InMemoryCircuitBreakerStateStore,
} from "./CircuitBreakerState";
import { CircuitBreakerOpenProblem } from "./errors/CircuitBreakerOpenProblem";
import { InvalidRetryConfigurationError } from "./errors/RetryInfrastructureProblem";
import { CircuitBreakerUnexpectedStateProblem } from "./problems/CircuitBreakerProblems";

export interface CircuitBreakerOptions {
  circuitId: string;
  failureThreshold?: number;
  openDuration?: number;
  halfOpenRequests?: number;
  stateStore?: CircuitBreakerStateStore;
  fallback?: CircuitBreakerFallback;
}

/**
 * Fallback function type for circuit breaker.
 */
export type CircuitBreakerFallback<T = unknown> = () => T | Promise<T>;

/**
 * 실패율이 높은 의존성 호출을 차단하고 회복 여부를 관리하는 서킷 브레이커입니다.
 */
export class CircuitBreaker {
  private readonly circuitId: string;
  private readonly failureThreshold: number;
  private readonly openDuration: number;
  private readonly halfOpenRequests: number;
  private readonly stateStore: CircuitBreakerStateStore;
  private readonly fallback?: CircuitBreakerFallback;
  private _closedActiveCount = 0;

  constructor(options: CircuitBreakerOptions) {
    const failureThreshold = options.failureThreshold ?? 5;
    const openDuration = options.openDuration ?? 30000;

    if (!Number.isInteger(failureThreshold) || failureThreshold <= 0) {
      throw new InvalidRetryConfigurationError(
        `failureThreshold must be a positive integer, got ${failureThreshold}`,
      );
    }
    if (!Number.isFinite(openDuration) || openDuration <= 0) {
      throw new InvalidRetryConfigurationError(
        `openDuration must be a positive number, got ${openDuration}`,
      );
    }

    this.circuitId = options.circuitId;
    this.failureThreshold = failureThreshold;
    this.openDuration = openDuration;
    this.halfOpenRequests = options.halfOpenRequests ?? 1;
    this.stateStore = options.stateStore ?? new InMemoryCircuitBreakerStateStore();
    this.fallback = options.fallback;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const state = await this.stateStore.getState(this.circuitId);

    switch (state) {
      case CircuitState.OPEN:
        return this.handleOpen(fn);
      case CircuitState.HALF_OPEN:
        return this.handleHalfOpen(fn);
      case CircuitState.CLOSED:
        return this.handleClosed(fn);
      default: {
        const exhaustive: never = state;
        throw new CircuitBreakerUnexpectedStateProblem(exhaustive);
      }
    }
  }

  private async handleOpen<T>(fn: () => Promise<T>): Promise<T> {
    const transition = await this.withCircuitLock(async () => {
      const currentState = await this.stateStore.getState(this.circuitId);

      if (currentState === CircuitState.CLOSED || currentState === CircuitState.HALF_OPEN) {
        return currentState;
      }

      const lastFailureTime = await this.stateStore.getLastFailureTime(this.circuitId);
      if (lastFailureTime === null) {
        return CircuitState.OPEN;
      }

      if (Date.now() - lastFailureTime < this.openDuration) {
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

    return this.rejectOpenCircuit();
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
      return this.rejectOpenCircuit();
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
    const failureCount = await this.stateStore.getFailureCount(this.circuitId);
    const projected = failureCount + this._closedActiveCount;
    if (projected >= this.failureThreshold) {
      return false;
    }

    this._closedActiveCount += 1;
    return true;
  }

  private releaseClosedExecutionSlot(): void {
    this._closedActiveCount = Math.max(0, this._closedActiveCount - 1);
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
    return this.stateStore.incrementFailureAndCheck(this.circuitId, this.failureThreshold);
  }

  private async withCircuitLock<T>(operation: () => Promise<T>): Promise<T> {
    return this.stateStore.withCircuitLock(this.circuitId, operation);
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
      await this.setHalfOpenActiveCount(Math.max(0, activeCount - 1));

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
  }

  private async getHalfOpenActiveCount(): Promise<number> {
    return this.stateStore.getHalfOpenActiveCount(this.circuitId);
  }

  private async setHalfOpenActiveCount(count: number): Promise<void> {
    await this.stateStore.setHalfOpenActiveCount(this.circuitId, count);
  }

  private async getHalfOpenSuccessCount(): Promise<number> {
    return this.stateStore.getHalfOpenSuccessCount(this.circuitId);
  }

  private async setHalfOpenSuccessCount(count: number): Promise<void> {
    await this.stateStore.setHalfOpenSuccessCount(this.circuitId, count);
  }

  private async rejectOpenCircuit<T>(): Promise<T> {
    if (this.fallback) {
      return this.fallback() as Promise<T>;
    }

    throw new CircuitBreakerOpenProblem(this.circuitId);
  }

  async forceOpen(): Promise<void> {
    await this.stateStore.setLastFailureTime(this.circuitId, Date.now());
    await this.setCircuitState(CircuitState.OPEN);
  }

  async forceClose(): Promise<void> {
    await this.stateStore.resetFailureCount(this.circuitId);
    await this.setCircuitState(CircuitState.CLOSED);
  }

  async reset(): Promise<void> {
    await this.stateStore.reset(this.circuitId);
  }

  async getState(): Promise<CircuitState> {
    return this.stateStore.getState(this.circuitId);
  }

  async getFailureCount(): Promise<number> {
    return this.stateStore.getFailureCount(this.circuitId);
  }

  async getLastFailureTime(): Promise<number | null> {
    return this.stateStore.getLastFailureTime(this.circuitId);
  }
}
