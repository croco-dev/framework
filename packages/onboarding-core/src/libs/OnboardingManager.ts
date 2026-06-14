import type { AnalyticsManager } from "@croco/analytics-core";
import { Component, Context } from "@croco/framework-context";
import type { OnboardingStore } from "./OnboardingStore";
import {
  OnboardingContextRequiredProblem,
  OnboardingDefinitionNotFoundProblem,
  OnboardingStepNotFoundProblem,
} from "./problems/OnboardingProblems";
import type { OnboardingDefinition, OnboardingState } from "./types";

@Component()
export class OnboardingManager {
  private readonly definitions = new Map<string, OnboardingDefinition>();

  constructor(
    private readonly store: OnboardingStore,
    private readonly analytics: AnalyticsManager,
  ) {}

  register(definition: OnboardingDefinition): void {
    this.definitions.set(definition.id, definition);
  }

  async getStatus(onboardingId: string): Promise<OnboardingState> {
    const { tenantId, userId } = this.getContext();
    const state = await this.store.getState(tenantId, userId, onboardingId);

    if (!state) {
      return { steps: {}, isCompleted: false };
    }
    return state;
  }

  async completeStep(onboardingId: string, stepId: string): Promise<void> {
    const definition = this.definitions.get(onboardingId);
    if (!definition) {
      throw new OnboardingDefinitionNotFoundProblem(onboardingId);
    }

    const step = definition.steps.find((s) => s.id === stepId);
    if (!step) {
      throw new OnboardingStepNotFoundProblem(onboardingId, stepId);
    }

    const { tenantId, userId } = this.getContext();
    const state = (await this.store.getState(tenantId, userId, onboardingId)) ?? {
      steps: {},
      isCompleted: false,
    };

    if (state.steps[stepId]?.completed) {
      return; // Already completed
    }

    const nextState: OnboardingState = {
      ...state,
      steps: {
        ...state.steps,
        [stepId]: {
          ...state.steps[stepId],
          completed: true,
          completedAt: new Date(),
        },
      },
    };

    const allRequiredCompleted = definition.steps
      .filter((s) => s.required !== false)
      .every((s) => nextState.steps[s.id]?.completed);

    const becameCompleted = allRequiredCompleted && !state.isCompleted;
    if (becameCompleted) {
      nextState.isCompleted = true;
      nextState.completedAt = new Date();
    }

    await this.store.saveState(tenantId, userId, onboardingId, nextState);

    if (becameCompleted) {
      this.captureAnalytics("onboarding_completed", {
        onboardingId,
        completedAt: nextState.completedAt,
      });
    }

    this.captureAnalytics("onboarding_step_completed", {
      onboardingId,
      stepId,
      stepTitle: step.title,
    });
  }

  private getContext(): { tenantId: string; userId: string } {
    const tenantId = Context.getTenantId();
    const user = Context.getCurrentUser();

    if (!tenantId || !user?.id) {
      throw new OnboardingContextRequiredProblem();
    }

    return { tenantId, userId: user.id };
  }

  private captureAnalytics(event: string, properties: Record<string, unknown>): void {
    try {
      this.analytics.capture(event, properties);
    } catch {
      // Analytics delivery is best-effort after persistence.
    }
  }
}
