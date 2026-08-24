import { Component, Token } from "@croco/framework-context";
import { OnboardingStateSnapshotUnsupportedProblem } from "./problems/OnboardingProblems";
import type {
  CompleteOnboardingStepInput,
  CompleteOnboardingStepResult,
  OnboardingState,
} from "./types";

const ARRAY_BUFFER_VIEW_CONSTRUCTOR_NAMES = [
  "DataView",
  "Int8Array",
  "Uint8Array",
  "Uint8ClampedArray",
  "Int16Array",
  "Uint16Array",
  "Int32Array",
  "Uint32Array",
  "Float16Array",
  "Float32Array",
  "Float64Array",
  "BigInt64Array",
  "BigUint64Array",
] as const;

const SUPPORTED_ARRAY_BUFFER_VIEW_PROTOTYPES = new Set<object>(
  ARRAY_BUFFER_VIEW_CONSTRUCTOR_NAMES.map((constructorName) => {
    const constructor = Reflect.get(globalThis, constructorName);
    const prototype =
      typeof constructor === "function" ? Reflect.get(constructor, "prototype") : null;
    return prototype !== null && typeof prototype === "object" ? prototype : null;
  }).filter((prototype): prototype is object => prototype !== null),
);

function snapshotOnboardingState(state: OnboardingState): OnboardingState {
  try {
    assertIndependentlyCloneable(state);
    const snapshot = structuredClone(state);
    assertIndependentlyCloneable(snapshot);
    return snapshot;
  } catch (cause) {
    if (cause instanceof OnboardingStateSnapshotUnsupportedProblem) {
      throw cause;
    }
    throw new OnboardingStateSnapshotUnsupportedProblem(cause instanceof Error ? cause : undefined);
  }
}

function assertIndependentlyCloneable(value: unknown, visited = new WeakSet<object>()): void {
  if (
    value === null ||
    value === undefined ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return;
  }
  if (typeof value !== "object") {
    throw new OnboardingStateSnapshotUnsupportedProblem();
  }
  if (visited.has(value)) {
    return;
  }
  visited.add(value);

  if (value instanceof Date) {
    if (Object.getPrototypeOf(value) !== Date.prototype) {
      throw new OnboardingStateSnapshotUnsupportedProblem();
    }
    assertNoOwnProperties(value);
    return;
  }
  if (value instanceof ArrayBuffer) {
    if (Object.getPrototypeOf(value) !== ArrayBuffer.prototype) {
      throw new OnboardingStateSnapshotUnsupportedProblem();
    }
    assertNoOwnProperties(value);
    return;
  }
  if (ArrayBuffer.isView(value)) {
    const prototype = Object.getPrototypeOf(value);
    if (
      !SUPPORTED_ARRAY_BUFFER_VIEW_PROTOTYPES.has(prototype) ||
      !(value.buffer instanceof ArrayBuffer)
    ) {
      throw new OnboardingStateSnapshotUnsupportedProblem();
    }
    if (prototype === DataView.prototype) {
      assertNoOwnProperties(value);
    } else {
      assertTypedArrayOwnProperties(value, visited);
    }
    return;
  }
  if (Array.isArray(value)) {
    if (Object.getPrototypeOf(value) !== Array.prototype) {
      throw new OnboardingStateSnapshotUnsupportedProblem();
    }
    assertSupportedOwnProperties(value, visited);
    return;
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new OnboardingStateSnapshotUnsupportedProblem();
  }

  assertSupportedOwnProperties(value, visited);
}

function assertNoOwnProperties(value: object): void {
  if (Reflect.ownKeys(value).length > 0) {
    throw new OnboardingStateSnapshotUnsupportedProblem();
  }
}

function assertTypedArrayOwnProperties(value: object, visited: WeakSet<object>): void {
  for (const propertyKey of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, propertyKey);
    const index = typeof propertyKey === "string" ? Number(propertyKey) : Number.NaN;
    if (
      typeof propertyKey !== "string" ||
      !Number.isInteger(index) ||
      index < 0 ||
      String(index) !== propertyKey ||
      !descriptor?.enumerable ||
      !("value" in descriptor)
    ) {
      throw new OnboardingStateSnapshotUnsupportedProblem();
    }
    assertIndependentlyCloneable(descriptor.value, visited);
  }
}

function assertSupportedOwnProperties(value: object, visited: WeakSet<object>): void {
  for (const propertyKey of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, propertyKey);
    if (Array.isArray(value) && propertyKey === "length") {
      continue;
    }
    if (typeof propertyKey !== "string" || !descriptor?.enumerable || !("value" in descriptor)) {
      throw new OnboardingStateSnapshotUnsupportedProblem();
    }
    assertIndependentlyCloneable(descriptor.value, visited);
  }
}

export abstract class OnboardingStore {
  static readonly token = new Token<OnboardingStore>("OnboardingStore");

  abstract getState(
    tenantId: string,
    userId: string,
    onboardingId: string,
  ): Promise<OnboardingState | null>;
  abstract saveState(
    tenantId: string,
    userId: string,
    onboardingId: string,
    state: OnboardingState,
  ): Promise<void>;
  abstract completeStep(
    tenantId: string,
    userId: string,
    onboardingId: string,
    input: CompleteOnboardingStepInput,
  ): Promise<CompleteOnboardingStepResult>;
}

@Component()
export class InMemoryOnboardingStore extends OnboardingStore {
  private readonly storage = new Map<string, OnboardingState>();

  async getState(
    tenantId: string,
    userId: string,
    onboardingId: string,
  ): Promise<OnboardingState | null> {
    const key = this.getKey(tenantId, userId, onboardingId);
    const state = this.storage.get(key);
    return state ? snapshotOnboardingState(state) : null;
  }

  async saveState(
    tenantId: string,
    userId: string,
    onboardingId: string,
    state: OnboardingState,
  ): Promise<void> {
    const key = this.getKey(tenantId, userId, onboardingId);
    this.storage.set(key, snapshotOnboardingState(state));
  }

  async completeStep(
    tenantId: string,
    userId: string,
    onboardingId: string,
    input: CompleteOnboardingStepInput,
  ): Promise<CompleteOnboardingStepResult> {
    const key = this.getKey(tenantId, userId, onboardingId);
    const state = this.storage.get(key) ?? { steps: {}, isCompleted: false };

    if (state.steps[input.stepId]?.completed) {
      return { status: "already_completed" };
    }

    const nextState: OnboardingState = {
      ...state,
      steps: {
        ...state.steps,
        [input.stepId]: {
          ...state.steps[input.stepId],
          completed: true,
          completedAt: input.completedAt,
        },
      },
    };
    const allRequiredCompleted = input.requiredStepIds.every(
      (requiredStepId) => nextState.steps[requiredStepId]?.completed,
    );
    const onboardingCompleted = allRequiredCompleted && !state.isCompleted;

    if (onboardingCompleted) {
      nextState.isCompleted = true;
      nextState.completedAt = input.completedAt;
    }

    const storedState = snapshotOnboardingState(nextState);
    this.storage.set(key, storedState);
    return {
      status: "completed",
      state: snapshotOnboardingState(storedState),
      onboardingCompleted,
    };
  }

  private getKey(tenantId: string, userId: string, onboardingId: string): string {
    return `${tenantId}:${userId}:${onboardingId}`;
  }
}
