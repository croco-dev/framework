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

export type OnboardingEventType =
  | "step_completed"
  | "step_skipped"
  | "onboarding_completed"
  | "onboarding_started";

export interface OnboardingEvent {
  type: OnboardingEventType;
  tenantId: string;
  userId: string;
  onboardingId: string;
  stepId?: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}
