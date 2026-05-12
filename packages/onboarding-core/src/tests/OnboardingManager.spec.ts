import "reflect-metadata";
import type { AnalyticsManager } from "@croco/analytics-core";
import { Context } from "@croco/framework-context";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OnboardingManager } from "../libs/OnboardingManager";
import { InMemoryOnboardingStore } from "../libs/OnboardingStore";
import {
  OnboardingContextRequiredProblem,
  OnboardingDefinitionNotFoundProblem,
  OnboardingStepNotFoundProblem,
} from "../libs/problems/OnboardingProblems";
import type { OnboardingDefinition } from "../libs/types";

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
