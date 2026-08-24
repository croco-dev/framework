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
