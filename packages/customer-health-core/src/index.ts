// Classes
export { CustomerHealthService } from "./libs/CustomerHealthService";
// Events
export { HealthScoreDroppedEvent, HealthStatusChangedEvent } from "./libs/events";
export { HealthScoreCalculator } from "./libs/HealthScoreCalculator";
export { InMemoryHealthScoreStore } from "./libs/InMemoryHealthScoreStore";
export {
  createHealthScoreStoreConformanceSuite,
  type HealthScoreStoreConformanceCase,
  type HealthScoreStoreConformanceOptions,
  type HealthScoreStoreConformanceSuite,
} from "./libs/conformance";
export type { HealthTransitionEventIntent } from "./libs/eventIntent";
// Interfaces
export * from "./libs/interfaces";

// Problems
export {
  HealthEventIntentConflictProblem,
  HealthEventPublisherNotConfiguredProblem,
  HealthScoreNotFoundProblem,
  InvalidHealthScoreInputProblem,
} from "./libs/problems/HealthProblems";

// Types
export * from "./libs/types";
