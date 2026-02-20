import type { AnalyticsManager } from '@croco/analytics-core';
import { Component, Context } from '@croco/framework-context';
import type { OnboardingStore } from './OnboardingStore';
import {
  OnboardingContextRequiredProblem,
  OnboardingDefinitionNotFoundProblem,
  OnboardingStepNotFoundProblem,
} from './problems/OnboardingProblems';
import type { OnboardingDefinition, OnboardingState } from './types';

@Component()
export class OnboardingManager {
  private readonly definitions = new Map<string, OnboardingDefinition>();

  constructor(
    private readonly store: OnboardingStore,
    private readonly analytics: AnalyticsManager
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
    let state = await this.store.getState(tenantId, userId, onboardingId);

    if (!state) {
      state = { steps: {}, isCompleted: false };
    }

    if (state.steps[stepId]?.completed) {
      return; // Already completed
    }

    // Update state
    state.steps[stepId] = {
      completed: true,
      completedAt: new Date(),
    };

    // Check overall completion
    const allRequiredCompleted = definition.steps
      .filter((s) => s.required !== false)
      .every((s) => state?.steps[s.id]?.completed);

    if (allRequiredCompleted && !state.isCompleted) {
      state.isCompleted = true;
      state.completedAt = new Date();

      // Track onboarding completion
      this.analytics.capture('onboarding_completed', {
        onboardingId,
        completedAt: state.completedAt,
      });
    }

    await this.store.saveState(tenantId, userId, onboardingId, state);

    // Track step completion
    this.analytics.capture('onboarding_step_completed', {
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
}
