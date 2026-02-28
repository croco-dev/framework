/**
 * @packageDocumentation
 * Public API for onboarding workflow orchestration.
 */

/** Orchestrates onboarding status retrieval and step completion. */
export { OnboardingManager } from './libs/OnboardingManager';

/** Onboarding state store abstraction and in-memory implementation. */
export { InMemoryOnboardingStore, OnboardingStore } from './libs/OnboardingStore';

/** Problem types used by onboarding operations. */
export {
  OnboardingContextRequiredProblem,
  OnboardingDefinitionNotFoundProblem,
  OnboardingStepNotFoundProblem,
} from './libs/problems/OnboardingProblems';

/** Onboarding domain and state types. */
export * from './libs/types';
