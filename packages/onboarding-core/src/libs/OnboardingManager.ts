import { AnalyticsManager } from "@croco/analytics-core"; // oxlint-disable-line typescript/consistent-type-imports
import { Component, Context } from "@croco/framework-context";
import { OnboardingStore } from "./OnboardingStore"; // oxlint-disable-line typescript/consistent-type-imports
import {
  DuplicateOnboardingDefinitionProblem,
  OnboardingContextRequiredProblem,
  OnboardingDefinitionInvalidProblem,
  OnboardingDefinitionNotFoundProblem,
  OnboardingStepCompletionConflictProblem,
  OnboardingStepNotFoundProblem,
} from "./problems/OnboardingProblems";
import type { OnboardingDefinition, OnboardingEvent, OnboardingState } from "./types";
import { GoalContextInvalidProblem } from "./goals/GoalProblems";
import type { GoalAchievedEventIntent, GoalScope } from "./goals/types";

const STEP_COMPLETION_MAX_ATTEMPTS = 3;

@Component()
export class OnboardingManager {
  private readonly definitions = new Map<string, OnboardingDefinition>();
  private readonly goalStepBridges = new Map<string, { onboardingId: string; stepId: string }>();

  constructor(
    private readonly store: OnboardingStore,
    private readonly analytics: AnalyticsManager,
  ) {}

  register(definition: OnboardingDefinition): void {
    const registeredDefinition: OnboardingDefinition = {
      id: definition.id,
      metadata: definition.metadata && { ...definition.metadata },
      steps: definition.steps.map((step) => ({
        id: step.id,
        title: step.title,
        description: step.description,
        required: step.required,
        type: step.type,
        order: step.order,
        featureFlagKey: step.featureFlagKey,
        dependsOn: step.dependsOn?.slice(),
        metadata: step.metadata && { ...step.metadata },
      })),
    };

    if (this.definitions.has(registeredDefinition.id)) {
      throw new DuplicateOnboardingDefinitionProblem(registeredDefinition.id);
    }

    const stepIds = new Set<string>();
    for (const step of registeredDefinition.steps) {
      if (stepIds.has(step.id)) {
        throw new OnboardingDefinitionInvalidProblem(
          registeredDefinition.id,
          step.id,
          "duplicate-step-id",
        );
      }
      stepIds.add(step.id);
    }

    for (const step of registeredDefinition.steps) {
      if (step.dependsOn?.some((dependencyId) => !stepIds.has(dependencyId))) {
        throw new OnboardingDefinitionInvalidProblem(
          registeredDefinition.id,
          step.id,
          "unknown-step-dependency",
        );
      }
      if (step.dependsOn?.length) {
        throw new OnboardingDefinitionInvalidProblem(
          registeredDefinition.id,
          step.id,
          "unsupported-step-dependency",
        );
      }
      if (step.featureFlagKey !== undefined) {
        throw new OnboardingDefinitionInvalidProblem(
          registeredDefinition.id,
          step.id,
          "unsupported-feature-flag",
        );
      }
    }

    this.definitions.set(registeredDefinition.id, registeredDefinition);
  }

  registerGoalStepBridge(input: {
    scope: GoalScope;
    goalDefinitionId: string;
    onboardingId: string;
    stepId: string;
  }): void {
    const definition = this.definitions.get(input.onboardingId);
    if (!definition) throw new OnboardingDefinitionNotFoundProblem(input.onboardingId);
    if (!definition.steps.some((step) => step.id === input.stepId)) {
      throw new OnboardingStepNotFoundProblem(input.onboardingId, input.stepId);
    }
    for (const value of [
      input.scope.tenantId,
      input.scope.appId,
      input.scope.environmentId,
      input.goalDefinitionId,
    ]) {
      if (!value?.trim()) throw new GoalContextInvalidProblem("bridge");
    }
    const key = JSON.stringify([
      input.scope.tenantId,
      input.scope.appId,
      input.scope.environmentId,
      input.goalDefinitionId,
    ]);
    if (this.goalStepBridges.has(key)) {
      throw new OnboardingDefinitionInvalidProblem(
        input.onboardingId,
        input.stepId,
        "duplicate-goal-bridge",
      );
    }
    this.goalStepBridges.set(key, { onboardingId: input.onboardingId, stepId: input.stepId });
  }

  async handleGoalAchieved(event: GoalAchievedEventIntent): Promise<boolean> {
    const { tenantId, userId } = this.getContext();
    if (
      tenantId !== event.scope.tenantId ||
      userId !== event.subject.id ||
      event.subject.verified !== true
    ) {
      throw new GoalContextInvalidProblem("goal-achieved-subject");
    }
    const key = JSON.stringify([
      event.scope.tenantId,
      event.scope.appId,
      event.scope.environmentId,
      event.definitionId,
    ]);
    const bridge = this.goalStepBridges.get(key);
    if (!bridge) return false;
    await this.completeStep(bridge.onboardingId, bridge.stepId);
    return true;
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
      .filter(
        (definitionStep) =>
          definitionStep.required ??
          (definitionStep.type !== "optional" && definitionStep.type !== "conditional"),
      )
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
        this.captureAnalytics({
          type: "onboarding_completed",
          properties: { onboardingId, completedAt: result.state.completedAt },
        });
      }

      this.captureAnalytics({
        type: "onboarding_step_completed",
        properties: { onboardingId, stepId, stepTitle: step.title },
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

  private captureAnalytics(event: OnboardingEvent): void {
    try {
      this.analytics.capture(event.type, event.properties);
    } catch {
      // Analytics delivery is best-effort after persistence.
    }
  }
}
