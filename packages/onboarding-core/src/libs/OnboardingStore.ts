import { Component, Token } from "@croco/framework-context";
import type {
  CompleteOnboardingStepInput,
  CompleteOnboardingStepResult,
  OnboardingState,
} from "./types";

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
    return this.storage.get(key) ?? null;
  }

  async saveState(
    tenantId: string,
    userId: string,
    onboardingId: string,
    state: OnboardingState,
  ): Promise<void> {
    const key = this.getKey(tenantId, userId, onboardingId);
    this.storage.set(key, state);
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

    this.storage.set(key, nextState);
    return { status: "completed", state: nextState, onboardingCompleted };
  }

  private getKey(tenantId: string, userId: string, onboardingId: string): string {
    return `${tenantId}:${userId}:${onboardingId}`;
  }
}
