import { Problem, toHttpStatus } from "@croco/problems-core";
import { recordEvent } from "@croco/telemetry-api";
import {
  type CircuitBreakerStateStore,
  CircuitState,
  InMemoryCircuitBreakerStateStore,
} from "./CircuitBreakerState";
import { CircuitBreakerOpenProblem } from "./errors/CircuitBreakerOpenProblem";
import { CircuitBreakerUnexpectedStateProblem } from "./problems/CircuitBreakerProblems";
import { assertValidRetryNumber } from "./numericValidation";

export interface CircuitBreakerOptions {
  circuitId: string;
  /** Positive safe integer (default: 5). */
  failureThreshold?: number;
  /** Positive integer milliseconds up to 2,147,483,647 (default: 30000). */
  openDuration?: number;
  /** Positive safe integer (default: 1). */
  halfOpenRequests?: number;
  stateStore?: CircuitBreakerStateStore;
  fallback?: CircuitBreakerFallback;
  /** Return true when an error should count toward opening the circuit. */
  recordFailure?: (error: unknown) => boolean;
}

function defaultRecordFailure(error: unknown): boolean {
  if (!(error instanceof Problem)) {
    return true;
  }

  const status = toHttpStatus(error.category);
  return status >= 500 || status === 429;
}

/**
 * Fallback function type for circuit breaker.
 */
export type CircuitBreakerFallback<T = unknown> = () => T | Promise<T>;

type HalfOpenSlot = { lastFailureTime: number | null };

/**
 * 실패율이 높은 의존성 호출을 차단하고 회복 여부를 관리하는 서킷 브레이커입니다.
 */
export class CircuitBreaker {
  private readonly circuitId: string;
  private readonly failureThreshold: number;
  private readonly openDuration: number;
  private readonly halfOpenRequests: number;
  private readonly stateStore: CircuitBreakerStateStore;
  private readonly fallback: CircuitBreakerFallback | undefined;
  private readonly recordFailure: (error: unknown) => boolean;

  constructor(options: CircuitBreakerOptions) {
    const failureThreshold = options.failureThreshold ?? 5;
    const openDuration = options.openDuration ?? 30000;
    const halfOpenRequests = options.halfOpenRequests ?? 1;

    assertValidRetryNumber(
      "circuitBreaker.failureThreshold",
      failureThreshold,
      "positive-safe-integer",
    );
    assertValidRetryNumber("circuitBreaker.openDuration", openDuration, "positive-timer-integer");
    assertValidRetryNumber(
      "circuitBreaker.halfOpenRequests",
      halfOpenRequests,
      "positive-safe-integer",
    );

    this.circuitId = options.circuitId;
    this.failureThreshold = failureThreshold;
    this.openDuration = openDuration;
    this.halfOpenRequests = halfOpenRequests;
    this.stateStore = options.stateStore ?? new InMemoryCircuitBreakerStateStore();
    this.fallback = options.fallback;
    this.recordFailure = options.recordFailure ?? defaultRecordFailure;
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
      // Keep the cycle marker alive at least as long as the Redis HALF_OPEN state.
      await this.stateStore.setLastFailureTime(this.circuitId, lastFailureTime);
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
    const slot = await this.tryAcquireHalfOpenSlot();
    if (!slot) {
      throw new CircuitBreakerOpenProblem(this.circuitId);
    }

    let result: T;
    try {
      result = await fn();
    } catch (error) {
      let shouldRecord: boolean;
      try {
        shouldRecord = this.recordFailure(error);
      } catch (classificationError) {
        await this.releaseHalfOpenSlot(slot);
        throw classificationError;
      }

      if (shouldRecord) {
        await this.markHalfOpenFailure(slot);
      } else {
        await this.releaseHalfOpenSlot(slot);
        throw error;
      }
      throw error instanceof Error ? error : new Error(String(error));
    }

    await this.recordSuccessBookkeeping(CircuitState.HALF_OPEN, () =>
      this.markHalfOpenSuccess(slot),
    );
    return result;
  }

  private async handleClosed<T>(fn: () => Promise<T>): Promise<T> {
    const canExecute = await this.canExecuteClosed();
    if (!canExecute) {
      return this.rejectOpenCircuit();
    }

    let result: T;
    try {
      result = await fn();
    } catch (error) {
      if (!this.recordFailure(error)) {
        throw error;
      }
      await this.recordClosedFailure();
      throw error instanceof Error ? error : new Error(String(error));
    }

    await this.recordSuccessBookkeeping(CircuitState.CLOSED, () => this.recordClosedSuccess());
    return result;
  }

  private async recordSuccessBookkeeping(
    state: CircuitState,
    operation: () => Promise<void>,
  ): Promise<void> {
    try {
      await operation();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      try {
        recordEvent("circuit_breaker.bookkeeping_failed", {
          "circuit.id": this.circuitId,
          "circuit.state": state,
          "error.message": err.message,
          "error.type": err.name,
          "operation.succeeded": true,
        });
      } catch {
        // Observation failures must not replace an already successful operation outcome.
        return;
      }
    }
  }

  private async canExecuteClosed(): Promise<boolean> {
    const failureCount = await this.stateStore.getFailureCount(this.circuitId);
    return failureCount < this.failureThreshold;
  }

  private async recordClosedSuccess(): Promise<void> {
    await this.withCircuitLock(async () => {
      const state = await this.stateStore.getState(this.circuitId);
      if (state !== CircuitState.CLOSED) {
        return;
      }

      await this.stateStore.resetFailureCount(this.circuitId);
    });
  }

  private async recordClosedFailure(): Promise<void> {
    await this.withCircuitLock(async () => {
      const state = await this.stateStore.getState(this.circuitId);
      if (state !== CircuitState.CLOSED) {
        return;
      }

      const { shouldOpen } = await this.incrementFailureAndCheck();
      if (!shouldOpen) {
        return;
      }

      await this.stateStore.setLastFailureTime(this.circuitId, Date.now());
      const activeCount = await this.getHalfOpenActiveCount();
      await this.setHalfOpenActiveCount(Math.max(0, activeCount - 1));
      await this.setCircuitState(CircuitState.OPEN);
    });
  }

  private async incrementFailureAndCheck(): Promise<{ failureCount: number; shouldOpen: boolean }> {
    return this.stateStore.incrementFailureAndCheck(this.circuitId, this.failureThreshold);
  }

  private async withCircuitLock<T>(operation: () => Promise<T>): Promise<T> {
    return this.stateStore.withCircuitLock(this.circuitId, operation);
  }

  private async tryAcquireHalfOpenSlot(): Promise<HalfOpenSlot | undefined> {
    return this.withCircuitLock(async () => {
      const state = await this.stateStore.getState(this.circuitId);
      if (state !== CircuitState.HALF_OPEN) {
        return undefined;
      }

      const activeCount = await this.getHalfOpenActiveCount();
      if (activeCount >= this.halfOpenRequests) {
        return undefined;
      }

      const lastFailureTime = await this.stateStore.getLastFailureTime(this.circuitId);
      await this.setHalfOpenActiveCount(activeCount + 1);
      return { lastFailureTime };
    });
  }

  private async markHalfOpenSuccess(slot: HalfOpenSlot): Promise<void> {
    await this.withCircuitLock(async () => {
      if (!(await this.isCurrentHalfOpenSlot(slot))) {
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

  private async markHalfOpenFailure(slot: HalfOpenSlot): Promise<void> {
    await this.withCircuitLock(async () => {
      if (!(await this.isCurrentHalfOpenSlot(slot))) {
        return;
      }

      await this.setHalfOpenActiveCount(0);
      await this.setHalfOpenSuccessCount(0);
      await this.stateStore.setLastFailureTime(this.circuitId, Date.now());
      await this.setCircuitState(CircuitState.OPEN);
    });
  }

  private async releaseHalfOpenSlot(slot: HalfOpenSlot): Promise<void> {
    await this.withCircuitLock(async () => {
      if (!(await this.isCurrentHalfOpenSlot(slot))) {
        return;
      }

      const activeCount = await this.getHalfOpenActiveCount();
      await this.setHalfOpenActiveCount(Math.max(0, activeCount - 1));
    });
  }

  private async isCurrentHalfOpenSlot(slot: HalfOpenSlot): Promise<boolean> {
    return (
      (await this.stateStore.getState(this.circuitId)) === CircuitState.HALF_OPEN &&
      (await this.stateStore.getLastFailureTime(this.circuitId)) === slot.lastFailureTime
    );
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
