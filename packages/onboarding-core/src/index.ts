export { OnboardingManager } from "./libs/OnboardingManager";

export { GoalManager } from "./libs/goals/GoalManager";
export type {
  GoalPublicationAuthorizer,
  GoalReceiptVerifier,
  GoalSubjectVerifier,
} from "./libs/goals/GoalManager";
export { GoalStore, InMemoryGoalStore } from "./libs/goals/GoalStore";
export { validateGoalDefinition } from "./libs/goals/validateGoalDefinition";
export {
  GoalAuthorizationProblem,
  GoalConflictProblem,
  GoalContextInvalidProblem,
  GoalDefinitionInvalidProblem,
  GoalDefinitionNotFoundProblem,
  GoalEpisodeNotFoundProblem,
  GoalReceiptInvalidProblem,
} from "./libs/goals/GoalProblems";
export type {
  ActionReceipt,
  GoalAchievedEventIntent,
  GoalAnchor,
  GoalCorrection,
  GoalCountMode,
  GoalDefinition,
  GoalDefinitionPublication,
  GoalDeletedObjectPolicy,
  GoalEpisode,
  GoalEpisodeKey,
  GoalEpisodeStatus,
  GoalEvidence,
  GoalGuidanceStep,
  GoalObservationResult,
  GoalProgress,
  GoalScope,
  GoalSubject,
} from "./libs/goals/types";

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
  OnboardingDefinitionInvalidProblem,
  OnboardingDefinitionNotFoundProblem,
  OnboardingStateSnapshotUnsupportedProblem,
  OnboardingStepCompletionConflictProblem,
  OnboardingStepNotFoundProblem,
} from "./libs/problems/OnboardingProblems";
export type { OnboardingDefinitionInvalidReason } from "./libs/problems/OnboardingProblems";

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
