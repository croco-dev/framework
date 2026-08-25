import { AnalyticsManager } from "@croco/analytics-core"; // oxlint-disable-line typescript/consistent-type-imports
import { Component, Context } from "@croco/framework-context";
import { OnboardingStore } from "./OnboardingStore"; // oxlint-disable-line typescript/consistent-type-imports
import {
  DuplicateOnboardingDefinitionProblem,
  OnboardingContextRequiredProblem,
  OnboardingDefinitionNotFoundProblem,
  OnboardingStepCompletionConflictProblem,
  OnboardingStepNotFoundProblem,
} from "./problems/OnboardingProblems";
import type { OnboardingDefinition, OnboardingState } from "./types";

const STEP_COMPLETION_MAX_ATTEMPTS = 3;

@Component()
export class OnboardingManager {
  private readonly definitions = new Map<string, OnboardingDefinition>();

  constructor(
    private readonly store: OnboardingStore,
    private readonly analytics: AnalyticsManager,
  ) {}

  register(definition: OnboardingDefinition): void {
    if (this.definitions.has(definition.id)) {
      throw new DuplicateOnboardingDefinitionProblem(definition.id);
    }

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
    const requiredStepIds = definition.steps
      .filter((definitionStep) => definitionStep.required !== false)
      .map((definitionStep) => definitionStep.id);

    for (let attempt = 0; attempt < STEP_COMPLETION_MAX_ATTEMPTS; attempt += 1) {
      const result = await this.store.completeStep(tenantId, userId, onboardingId, {
        stepId,
        completedAt: new Date(),
        requiredStepIds,
      });

      if (result.status === "conflict") {
        continue;
      }
      if (result.status === "already_completed") {
        return;
      }

      if (result.onboardingCompleted) {
        this.captureAnalytics("onboarding_completed", {
          onboardingId,
          completedAt: result.state.completedAt,
        });
      }

      this.captureAnalytics("onboarding_step_completed", {
        onboardingId,
        stepId,
        stepTitle: step.title,
      });
      return;
    }

    throw new OnboardingStepCompletionConflictProblem(onboardingId, stepId);
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
