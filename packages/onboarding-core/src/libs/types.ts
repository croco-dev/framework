export type OnboardingStepType = "required" | "optional" | "conditional";

export interface OnboardingStep {
  id: string;
  title: string;
  description?: string;
  required?: boolean;
  type?: OnboardingStepType;
  order?: number;
  featureFlagKey?: string;
  dependsOn?: string[];
  metadata?: Record<string, unknown>;
}

export interface StepState {
  completed: boolean;
  completedAt?: Date;
  metadata?: Record<string, unknown>;
}

export type OnboardingStatus = "not_started" | "in_progress" | "completed" | "skipped";

export interface OnboardingState {
  steps: Record<string, StepState>;
  isCompleted: boolean;
  completedAt?: Date;
  status?: OnboardingStatus;
  startedAt?: Date;
  currentStepId?: string;
}

export interface CompleteOnboardingStepInput {
  stepId: string;
  completedAt: Date;
  requiredStepIds: readonly string[];
}

export type CompleteOnboardingStepResult =
  | {
      status: "completed";
      state: OnboardingState;
      onboardingCompleted: boolean;
    }
  | {
      status: "already_completed";
    }
  | {
      status: "conflict";
    };

export interface OnboardingDefinition {
  id: string;
  steps: OnboardingStep[];
  metadata?: Record<string, unknown>;
}

export interface OnboardingContext {
  tenantId: string;
  userId: string;
  onboardingId: string;
}

export type OnboardingEventType = "onboarding_step_completed" | "onboarding_completed";

export type OnboardingEvent =
  | {
      type: "onboarding_step_completed";
      properties: { onboardingId: string; stepId: string; stepTitle: string };
    }
  | {
      type: "onboarding_completed";
      properties: { onboardingId: string; completedAt?: Date };
    };
