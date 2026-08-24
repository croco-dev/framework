import "reflect-metadata";
import type { AnalyticsManager } from "@croco/analytics-core";
import { Context } from "@croco/framework-context";
import { ProblemCategory } from "@croco/problems-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OnboardingManager } from "../libs/OnboardingManager";
import { InMemoryOnboardingStore, OnboardingStore } from "../libs/OnboardingStore";
import {
  DuplicateOnboardingDefinitionProblem,
  OnboardingContextRequiredProblem,
  OnboardingDefinitionNotFoundProblem,
  OnboardingStateSnapshotUnsupportedProblem,
  OnboardingStepCompletionConflictProblem,
  OnboardingStepNotFoundProblem,
} from "../libs/problems/OnboardingProblems";
import type {
  CompleteOnboardingStepInput,
  CompleteOnboardingStepResult,
  OnboardingDefinition,
  OnboardingState,
} from "../libs/types";

class RecordingOnboardingStore extends InMemoryOnboardingStore {
  constructor(private readonly operations: string[]) {
    super();
  }

  override async completeStep(
    tenantId: string,
    userId: string,
    onboardingId: string,
    input: CompleteOnboardingStepInput,
  ): Promise<CompleteOnboardingStepResult> {
    this.operations.push("save");
    return super.completeStep(tenantId, userId, onboardingId, input);
  }
}

class ReferenceFailingCompletionStore extends OnboardingStore {
  constructor(private readonly state: OnboardingState) {
    super();
  }

  async getState(): Promise<OnboardingState | null> {
    return this.state;
  }

  async saveState(): Promise<void> {
    throw new Error("unexpected save");
  }

  async completeStep(): Promise<CompleteOnboardingStepResult> {
    throw new Error("completion failed");
  }
}

class ConflictingOnboardingStore extends OnboardingStore {
  readonly completeStep = vi.fn<() => Promise<CompleteOnboardingStepResult>>(async () => ({
    status: "conflict",
  }));

  async getState(): Promise<OnboardingState | null> {
    return null;
  }

  async saveState(): Promise<void> {
    throw new Error("unexpected save");
  }
}

const unsupportedSnapshotCases: ReadonlyArray<readonly [string, () => unknown]> = [
  ["function", () => () => "caller-owned"],
  ["shared-memory", () => new Uint8Array(new SharedArrayBuffer(1))],
  [
    "error-cause",
    () => {
      const error = new Error("metadata");
      Object.defineProperty(error, "cause", { value: new SharedArrayBuffer(1) });
      return error;
    },
  ],
  ["webassembly-memory", () => new WebAssembly.Memory({ initial: 1, maximum: 1, shared: true })],
  [
    "hostile-proxy",
    () =>
      new Proxy(
        {},
        {
          getPrototypeOf: () => {
            throw new Error("raw proxy failure");
          },
        },
      ),
  ],
  [
    "array-shared-property",
    () =>
      Object.defineProperty([], "shared", {
        enumerable: true,
        value: new SharedArrayBuffer(1),
      }),
  ],
  [
    "accessor",
    () =>
      Object.defineProperty({}, "value", {
        enumerable: true,
        get: () => "caller-owned",
      }),
  ],
  [
    "hidden-accessor",
    () =>
      Object.defineProperty({}, "value", {
        get: () => "caller-owned",
      }),
  ],
  [
    "disguised-shared-memory",
    () => {
      const value = new SharedArrayBuffer(1);
      Object.setPrototypeOf(value, Object.prototype);
      return value;
    },
  ],
  [
    "disguised-webassembly-memory",
    () => {
      const value = new WebAssembly.Memory({ initial: 1, maximum: 1, shared: true });
      Object.setPrototypeOf(value, Object.prototype);
      return value;
    },
  ],
  [
    "custom-date",
    () => {
      class CustomDate extends Date {}
      return new CustomDate();
    },
  ],
  [
    "custom-array",
    () => {
      class CustomArray<T> extends Array<T> {}
      return new CustomArray();
    },
  ],
  [
    "custom-view",
    () => {
      class CustomBytes extends Uint8Array {}
      return new CustomBytes();
    },
  ],
  [
    "date-accessor",
    () =>
      Object.defineProperty(new Date(), "value", {
        get: () => "caller-owned",
      }),
  ],
  [
    "array-buffer-hidden-property",
    () => Object.defineProperty(new ArrayBuffer(1), "value", { value: "caller-owned" }),
  ],
  [
    "view-symbol-property",
    () =>
      Object.defineProperty(new Uint8Array(1), Symbol("value"), {
        enumerable: true,
        value: "caller-owned",
      }),
  ],
  [
    "date-enumerable-property",
    () =>
      Object.defineProperty(new Date(), "value", {
        enumerable: true,
        value: "caller-owned",
      }),
  ],
  [
    "array-buffer-enumerable-property",
    () =>
      Object.defineProperty(new ArrayBuffer(1), "value", {
        enumerable: true,
        value: "caller-owned",
      }),
  ],
  [
    "data-view-enumerable-property",
    () =>
      Object.defineProperty(new DataView(new ArrayBuffer(1)), "value", {
        enumerable: true,
        value: "caller-owned",
      }),
  ],
  [
    "typed-array-enumerable-property",
    () =>
      Object.defineProperty(new Uint8Array(1), "value", {
        enumerable: true,
        value: "caller-owned",
      }),
  ],
  [
    "forged-typed-array-prototype",
    () => {
      const value = new Uint8Array(1);
      Object.setPrototypeOf(value, Object.create(Object.getPrototypeOf(Uint8Array.prototype)));
      return value;
    },
  ],
];

describe("InMemoryOnboardingStore snapshot ownership", () => {
  it.each(unsupportedSnapshotCases)(
    "should reject %s metadata that cannot become an independent snapshot",
    async (onboardingId, createValue) => {
      const store = new InMemoryOnboardingStore();

      await expect(
        store.saveState("tenant-1", "user-1", onboardingId, {
          steps: {
            "step-1": {
              completed: false,
              metadata: { value: createValue() },
            },
          },
          isCompleted: false,
        }),
      ).rejects.toThrow(OnboardingStateSnapshotUnsupportedProblem);
      await expect(store.getState("tenant-1", "user-1", onboardingId)).resolves.toBeNull();
    },
  );

  it("should isolate supported binary metadata", async () => {
    const store = new InMemoryOnboardingStore();
    const ownedBytes = new Uint8Array([1, 2, 3]);
    await expect(
      store.saveState("tenant-1", "user-1", "supported-binary-metadata", {
        steps: {
          "step-1": {
            completed: false,
            metadata: { bytes: ownedBytes },
          },
        },
        isCompleted: false,
      }),
    ).resolves.toBeUndefined();
    ownedBytes[0] = 9;
    const binaryState = await store.getState("tenant-1", "user-1", "supported-binary-metadata");
    expect(binaryState?.steps["step-1"]?.metadata?.["bytes"]).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("should isolate saved state and loaded snapshots including nested metadata and dates", async () => {
    const store = new InMemoryOnboardingStore();
    const stepCompletedAt = new Date("2026-01-02T00:00:00.000Z");
    const onboardingCompletedAt = new Date("2026-01-03T00:00:00.000Z");
    const startedAt = new Date("2026-01-01T00:00:00.000Z");
    const metadataUpdatedAt = new Date("2026-01-01T12:00:00.000Z");
    const metadata = {
      profile: { displayName: "Original", updatedAt: metadataUpdatedAt },
      flags: ["initial"],
    };
    const stepState = {
      completed: true,
      completedAt: stepCompletedAt,
      metadata,
    };
    const savedState: OnboardingState = {
      steps: { "step-1": stepState },
      isCompleted: true,
      completedAt: onboardingCompletedAt,
      status: "completed",
      startedAt,
      currentStepId: "step-1",
    };

    await store.saveState("tenant-1", "user-1", "welcome-tour", savedState);

    stepState.completed = false;
    stepCompletedAt.setUTCFullYear(2030);
    onboardingCompletedAt.setUTCFullYear(2030);
    startedAt.setUTCFullYear(2030);
    metadata.profile.displayName = "Mutated input";
    metadataUpdatedAt.setUTCFullYear(2030);
    metadata.flags.push("mutated-input");
    savedState.isCompleted = false;

    const loadedState = await store.getState("tenant-1", "user-1", "welcome-tour");
    expect(loadedState).toEqual({
      steps: {
        "step-1": {
          completed: true,
          completedAt: new Date("2026-01-02T00:00:00.000Z"),
          metadata: {
            profile: {
              displayName: "Original",
              updatedAt: new Date("2026-01-01T12:00:00.000Z"),
            },
            flags: ["initial"],
          },
        },
      },
      isCompleted: true,
      completedAt: new Date("2026-01-03T00:00:00.000Z"),
      status: "completed",
      startedAt: new Date("2026-01-01T00:00:00.000Z"),
      currentStepId: "step-1",
    });

    if (!loadedState) {
      throw new Error("expected saved onboarding state");
    }
    const loadedStep = loadedState.steps["step-1"];
    if (!loadedStep) {
      throw new Error("expected saved onboarding step");
    }
    const loadedMetadata = loadedStep.metadata as typeof metadata;
    loadedStep.completed = false;
    loadedStep.completedAt?.setUTCFullYear(2040);
    loadedMetadata.profile.displayName = "Mutated output";
    loadedMetadata.profile.updatedAt.setUTCFullYear(2040);
    loadedMetadata.flags.push("mutated-output");
    loadedState.isCompleted = false;
    loadedState.completedAt?.setUTCFullYear(2040);
    loadedState.startedAt?.setUTCFullYear(2040);

    await expect(store.getState("tenant-1", "user-1", "welcome-tour")).resolves.toEqual({
      steps: {
        "step-1": {
          completed: true,
          completedAt: new Date("2026-01-02T00:00:00.000Z"),
          metadata: {
            profile: {
              displayName: "Original",
              updatedAt: new Date("2026-01-01T12:00:00.000Z"),
            },
            flags: ["initial"],
          },
        },
      },
      isCompleted: true,
      completedAt: new Date("2026-01-03T00:00:00.000Z"),
      status: "completed",
      startedAt: new Date("2026-01-01T00:00:00.000Z"),
      currentStepId: "step-1",
    });
  });

  it("should isolate successful completion results and their completion timestamp", async () => {
    const store = new InMemoryOnboardingStore();
    const stepMetadata = { nested: { source: "stored" } };
    await store.saveState("tenant-1", "user-1", "welcome-tour", {
      steps: { "step-1": { completed: false, metadata: stepMetadata } },
      isCompleted: false,
    });
    const completedAt = new Date("2026-02-01T00:00:00.000Z");

    const result = await store.completeStep("tenant-1", "user-1", "welcome-tour", {
      stepId: "step-1",
      completedAt,
      requiredStepIds: ["step-1"],
    });

    expect(result.status).toBe("completed");
    if (result.status !== "completed") {
      throw new Error("expected successful onboarding step completion");
    }
    const resultStep = result.state.steps["step-1"];
    if (!resultStep) {
      throw new Error("expected completed onboarding step");
    }
    resultStep.completed = false;
    (resultStep.metadata as typeof stepMetadata).nested.source = "mutated result";
    resultStep.completedAt?.setUTCFullYear(2030);
    result.state.isCompleted = false;
    result.state.completedAt?.setUTCFullYear(2030);
    completedAt.setUTCFullYear(2040);

    await expect(store.getState("tenant-1", "user-1", "welcome-tour")).resolves.toEqual({
      steps: {
        "step-1": {
          completed: true,
          completedAt: new Date("2026-02-01T00:00:00.000Z"),
          metadata: { nested: { source: "stored" } },
        },
      },
      isCompleted: true,
      completedAt: new Date("2026-02-01T00:00:00.000Z"),
    });
  });
});

describe("OnboardingManager", () => {
  let manager!: OnboardingManager;
  let analytics!: AnalyticsManager;

  const sampleDefinition: OnboardingDefinition = {
    id: "welcome-tour",
    steps: [
      { id: "step-1", title: "Welcome", required: true },
      { id: "step-2", title: "Setup Profile", required: true },
      { id: "step-3", title: "Optional Step", required: false },
    ],
  };

  beforeEach(() => {
    const mockAnalytics = {
      capture: vi.fn(),
      identify: vi.fn(),
      group: vi.fn(),
    } as unknown as AnalyticsManager;

    const storeInstance = new InMemoryOnboardingStore();
    manager = new OnboardingManager(storeInstance, mockAnalytics);
    analytics = mockAnalytics;

    manager.register(sampleDefinition);
  });

  it("should reject duplicate definition IDs with stable configuration details", () => {
    let duplicateProblem: unknown;

    try {
      manager.register({
        id: sampleDefinition.id,
        steps: [{ id: "replacement-step", title: "Replacement" }],
      });
    } catch (problem) {
      duplicateProblem = problem;
    }

    expect(duplicateProblem).toBeInstanceOf(DuplicateOnboardingDefinitionProblem);
    expect(duplicateProblem).toMatchObject({
      code: "onboarding/duplicate-definition-registration",
      category: ProblemCategory.InternalServerError,
      detail: "Onboarding definition 'welcome-tour' is already registered",
      extensions: {
        onboardingId: "welcome-tour",
        retryable: false,
      },
    });
  });

  it("should preserve original completion requirements and analytics after a collision", async () => {
    expect(() =>
      manager.register({
        id: sampleDefinition.id,
        steps: [{ id: "step-1", title: "Replacement Welcome", required: true }],
      }),
    ).toThrow(DuplicateOnboardingDefinitionProblem);

    await Context.run(
      { requestId: "req-duplicate", user: { id: "user-1" }, tenantId: "tenant-1" },
      async () => {
        await manager.completeStep("welcome-tour", "step-1");

        expect(analytics.capture).not.toHaveBeenCalledWith(
          "onboarding_completed",
          expect.anything(),
        );
        expect(analytics.capture).toHaveBeenCalledWith("onboarding_step_completed", {
          onboardingId: "welcome-tour",
          stepId: "step-1",
          stepTitle: "Welcome",
        });

        await manager.completeStep("welcome-tour", "step-2");

        const status = await manager.getStatus("welcome-tour");
        expect(status.isCompleted).toBe(true);
      },
    );
  });

  it("should register and complete unique definitions independently", async () => {
    manager.register({
      id: "product-tour",
      steps: [{ id: "tour-step", title: "Product Tour", required: true }],
    });

    await Context.run(
      { requestId: "req-unique", user: { id: "user-1" }, tenantId: "tenant-1" },
      async () => {
        await manager.completeStep("product-tour", "tour-step");

        const status = await manager.getStatus("product-tour");
        expect(status.isCompleted).toBe(true);
      },
    );
  });

  it("should capture event when a step is completed", async () => {
    await Context.run(
      { requestId: "req-1", user: { id: "user-1" }, tenantId: "tenant-1" },
      async () => {
        await manager.completeStep("welcome-tour", "step-1");

        expect(analytics.capture).toHaveBeenCalledWith(
          "onboarding_step_completed",
          expect.objectContaining({
            onboardingId: "welcome-tour",
            stepId: "step-1",
          }),
        );
      },
    );
  });

  it("should isolate getStatus mutations from persisted progress and analytics", async () => {
    const store = new InMemoryOnboardingStore();
    const managerWithSavedState = new OnboardingManager(store, analytics);
    managerWithSavedState.register(sampleDefinition);
    await store.saveState("tenant-1", "user-1", "welcome-tour", {
      steps: {
        "step-1": {
          completed: false,
          metadata: { nested: { source: "stored" } },
        },
      },
      isCompleted: false,
      startedAt: new Date("2026-03-01T00:00:00.000Z"),
    });

    await Context.run(
      { requestId: "req-snapshot", user: { id: "user-1" }, tenantId: "tenant-1" },
      async () => {
        const exposedStatus = await managerWithSavedState.getStatus("welcome-tour");
        const exposedStep = exposedStatus.steps["step-1"];
        if (!exposedStep) {
          throw new Error("expected saved onboarding step");
        }
        exposedStep.completed = true;
        (exposedStep.metadata as { nested: { source: string } }).nested.source = "caller";
        exposedStatus.isCompleted = true;
        exposedStatus.completedAt = new Date("2026-03-02T00:00:00.000Z");
        exposedStatus.startedAt?.setUTCFullYear(2030);

        expect(analytics.capture).not.toHaveBeenCalled();
        await expect(managerWithSavedState.getStatus("welcome-tour")).resolves.toEqual({
          steps: {
            "step-1": {
              completed: false,
              metadata: { nested: { source: "stored" } },
            },
          },
          isCompleted: false,
          startedAt: new Date("2026-03-01T00:00:00.000Z"),
        });

        await managerWithSavedState.completeStep("welcome-tour", "step-1");
      },
    );

    expect(analytics.capture).toHaveBeenCalledTimes(1);
    expect(analytics.capture).toHaveBeenCalledWith(
      "onboarding_step_completed",
      expect.objectContaining({ onboardingId: "welcome-tour", stepId: "step-1" }),
    );
  });

  it("should capture completion event when all required steps are done", async () => {
    await Context.run(
      { requestId: "req-2", user: { id: "user-1" }, tenantId: "tenant-1" },
      async () => {
        // Complete step 1
        await manager.completeStep("welcome-tour", "step-1");
        expect(analytics.capture).not.toHaveBeenCalledWith(
          "onboarding_completed",
          expect.anything(),
        );

        // Complete step 2 (Final required step)
        await manager.completeStep("welcome-tour", "step-2");

        expect(analytics.capture).toHaveBeenCalledWith(
          "onboarding_completed",
          expect.objectContaining({
            onboardingId: "welcome-tour",
          }),
        );
      },
    );
  });

  it("should preserve concurrent distinct step completions and emit completion once", async () => {
    await Context.run(
      { requestId: "req-concurrent", user: { id: "user-1" }, tenantId: "tenant-1" },
      async () => {
        await Promise.all([
          manager.completeStep("welcome-tour", "step-1"),
          manager.completeStep("welcome-tour", "step-2"),
        ]);

        const status = await manager.getStatus("welcome-tour");
        expect(status.steps["step-1"]?.completed).toBe(true);
        expect(status.steps["step-2"]?.completed).toBe(true);
        expect(status.isCompleted).toBe(true);
      },
    );

    expect(analytics.capture).toHaveBeenCalledWith(
      "onboarding_completed",
      expect.objectContaining({ onboardingId: "welcome-tour" }),
    );
    expect(
      vi.mocked(analytics.capture).mock.calls.filter(([event]) => event === "onboarding_completed"),
    ).toHaveLength(1);
  });

  it("should apply concurrent repeated completion of the same step once", async () => {
    await Context.run(
      { requestId: "req-idempotent", user: { id: "user-1" }, tenantId: "tenant-1" },
      async () => {
        await Promise.all([
          manager.completeStep("welcome-tour", "step-1"),
          manager.completeStep("welcome-tour", "step-1"),
        ]);
      },
    );

    expect(
      vi
        .mocked(analytics.capture)
        .mock.calls.filter(([event]) => event === "onboarding_step_completed"),
    ).toHaveLength(1);
  });

  it("should ignore optional steps for completion calculation", async () => {
    await Context.run(
      { requestId: "req-3", user: { id: "user-2" }, tenantId: "tenant-1" },
      async () => {
        await manager.completeStep("welcome-tour", "step-1");
        await manager.completeStep("welcome-tour", "step-2");

        // Should be completed even if step-3 is not done
        expect(analytics.capture).toHaveBeenCalledWith("onboarding_completed", expect.anything());
      },
    );
  });

  it("should persist state before emitting analytics events", async () => {
    const operations: string[] = [];
    const capture = vi.fn((event: string) => {
      operations.push(`analytics:${event}`);
    });
    const storeInstance = new RecordingOnboardingStore(operations);
    const orderedAnalytics = {
      capture,
      identify: vi.fn(),
      group: vi.fn(),
    } as unknown as AnalyticsManager;
    const orderedManager = new OnboardingManager(storeInstance, orderedAnalytics);
    orderedManager.register(sampleDefinition);

    await Context.run(
      { requestId: "req-8", user: { id: "user-1" }, tenantId: "tenant-1" },
      async () => {
        await orderedManager.completeStep("welcome-tour", "step-1");
        await orderedManager.completeStep("welcome-tour", "step-2");

        expect(operations).toEqual([
          "save",
          "analytics:onboarding_step_completed",
          "save",
          "analytics:onboarding_completed",
          "analytics:onboarding_step_completed",
        ]);

        const status = await orderedManager.getStatus("welcome-tour");
        expect(status.isCompleted).toBe(true);
        expect(status.steps["step-2"]?.completed).toBe(true);
      },
    );
  });

  it("should reject save failures without mutating existing state or emitting analytics", async () => {
    const initialState: OnboardingState = {
      steps: {
        "step-1": {
          completed: true,
          completedAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      },
      isCompleted: false,
    };
    const storeInstance = new ReferenceFailingCompletionStore(initialState);
    const failingManager = new OnboardingManager(storeInstance, analytics);
    failingManager.register(sampleDefinition);

    await Context.run(
      { requestId: "req-9", user: { id: "user-1" }, tenantId: "tenant-1" },
      async () => {
        await expect(failingManager.completeStep("welcome-tour", "step-2")).rejects.toThrow(
          "completion failed",
        );
      },
    );

    expect(analytics.capture).not.toHaveBeenCalled();
    expect(initialState.steps["step-2"]).toBeUndefined();
    expect(initialState.isCompleted).toBe(false);
    expect(initialState.completedAt).toBeUndefined();
  });

  it("should fail explicitly after bounded atomic completion conflicts", async () => {
    const storeInstance = new ConflictingOnboardingStore();
    const conflictingManager = new OnboardingManager(storeInstance, analytics);
    conflictingManager.register(sampleDefinition);

    await Context.run(
      { requestId: "req-conflict", user: { id: "user-1" }, tenantId: "tenant-1" },
      async () => {
        await expect(conflictingManager.completeStep("welcome-tour", "step-1")).rejects.toThrow(
          OnboardingStepCompletionConflictProblem,
        );
      },
    );

    expect(storeInstance.completeStep).toHaveBeenCalledTimes(3);
    expect(analytics.capture).not.toHaveBeenCalled();
  });

  it("should persist state and resolve when analytics capture throws after save", async () => {
    const capture = vi.fn(() => {
      throw new Error("analytics failed");
    });
    const throwingAnalytics = {
      capture,
      identify: vi.fn(),
      group: vi.fn(),
    } as unknown as AnalyticsManager;
    const storeInstance = new InMemoryOnboardingStore();
    const throwingManager = new OnboardingManager(storeInstance, throwingAnalytics);
    throwingManager.register(sampleDefinition);

    await Context.run(
      { requestId: "req-10", user: { id: "user-1" }, tenantId: "tenant-1" },
      async () => {
        await throwingManager.completeStep("welcome-tour", "step-1");
        await expect(
          throwingManager.completeStep("welcome-tour", "step-2"),
        ).resolves.toBeUndefined();

        const status = await throwingManager.getStatus("welcome-tour");
        expect(status.isCompleted).toBe(true);
        expect(status.steps["step-2"]?.completed).toBe(true);
      },
    );

    expect(capture).toHaveBeenCalledWith(
      "onboarding_completed",
      expect.objectContaining({ onboardingId: "welcome-tour" }),
    );
    expect(capture).toHaveBeenCalledWith(
      "onboarding_step_completed",
      expect.objectContaining({ onboardingId: "welcome-tour", stepId: "step-2" }),
    );
  });

  it("should store state per user and tenant", async () => {
    await Context.run(
      { requestId: "req-4", user: { id: "user-A" }, tenantId: "tenant-A" },
      async () => {
        await manager.completeStep("welcome-tour", "step-1");
      },
    );

    await Context.run(
      { requestId: "req-5", user: { id: "user-B" }, tenantId: "tenant-A" },
      async () => {
        const status = await manager.getStatus("welcome-tour");
        expect(status.steps["step-1"]).toBeUndefined(); // User B should not see User A's progress
      },
    );
  });

  it("should throw OnboardingDefinitionNotFoundProblem when definition does not exist", async () => {
    await Context.run(
      { requestId: "req-6", user: { id: "user-1" }, tenantId: "tenant-1" },
      async () => {
        await expect(manager.completeStep("missing", "step-1")).rejects.toThrow(
          OnboardingDefinitionNotFoundProblem,
        );
      },
    );
  });

  it("should throw OnboardingStepNotFoundProblem when step does not exist", async () => {
    await Context.run(
      { requestId: "req-7", user: { id: "user-1" }, tenantId: "tenant-1" },
      async () => {
        await expect(manager.completeStep("welcome-tour", "missing-step")).rejects.toThrow(
          OnboardingStepNotFoundProblem,
        );
      },
    );
  });

  it("should throw OnboardingContextRequiredProblem when context is missing", async () => {
    await expect(manager.completeStep("welcome-tour", "step-1")).rejects.toThrow(
      OnboardingContextRequiredProblem,
    );
  });
});
