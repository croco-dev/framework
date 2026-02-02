export interface OnboardingStep {
  id: string;
  title: string;
  description?: string;
  required?: boolean;
  /**
   * Optional feature flag key.
   * If provided, the step is only applicable if the feature is enabled.
   */
  featureFlagKey?: string;
}

export interface StepState {
  completed: boolean;
  completedAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface OnboardingState {
  steps: Record<string, StepState>;
  isCompleted: boolean;
  completedAt?: Date;
}

export interface OnboardingDefinition {
  id: string;
  steps: OnboardingStep[];
}
