export { OnboardingManager } from "./libs/OnboardingManager";

export { InMemoryOnboardingStore, OnboardingStore } from "./libs/OnboardingStore";

export {
  createOnboardingStoreConformanceSuite,
  type OnboardingStoreConformanceCase,
  type OnboardingStoreConformanceOptions,
  type OnboardingStoreConformanceSuite,
} from "./libs/conformance";

export {
  DuplicateOnboardingDefinitionProblem,
  OnboardingContextRequiredProblem,
  OnboardingDefinitionNotFoundProblem,
  OnboardingStepCompletionConflictProblem,
  OnboardingStepNotFoundProblem,
} from "./libs/problems/OnboardingProblems";

export type {
  OnboardingContext,
  CompleteOnboardingStepInput,
  CompleteOnboardingStepResult,
  OnboardingDefinition,
  OnboardingEvent,
  OnboardingEventType,
  OnboardingState,
  OnboardingStatus,
  OnboardingStep,
  OnboardingStepType,
  StepState,
} from "./libs/types";
