/**
 * Backoff policy contracts and option types for configuring retry delays.
 */
export type { BackoffDependencies, BackoffOptions, BackoffPolicy } from './libs/BackoffPolicy';

/**
 * Built-in backoff policy implementations for exponential, fixed, and immediate retries.
 */
export { ExponentialBackoff, FixedBackoff, NoBackoff } from './libs/BackoffPolicy';

/**
 * Configuration type for creating a circuit breaker.
 */
export type { CircuitBreakerOptions } from './libs/CircuitBreaker';

/**
 * Circuit breaker implementation for preventing repeated calls to unstable dependencies.
 */
export { CircuitBreaker } from './libs/CircuitBreaker';

/**
 * Retry template that combines retry execution with circuit breaker protection.
 */
export { CircuitBreakerRetryTemplate } from './libs/CircuitBreakerRetryTemplate';

/**
 * Circuit breaker state contracts and helper types for shared state storage.
 */
export {
  type CircuitBreakerStateStore,
  CircuitState,
  type DistributedCircuitBreakerStateStore,
  InMemoryCircuitBreakerStateStore,
  isDistributedStore,
} from './libs/CircuitBreakerState';

/**
 * Problem types raised when retry execution is blocked or fully exhausted.
 */
export { CircuitBreakerOpenProblem, RetryExhaustedProblem } from './libs/errors';

/**
 * Lambda timeout guard types for integrating retry logic with AWS Lambda execution limits.
 */
export type { LambdaContext, TimeoutGuardOptions } from './libs/LambdaTimeoutGuard';

/**
 * Lambda timeout guard utilities for tracking remaining execution time during retries.
 */
export {
  getLambdaContext,
  getRemainingTimeInMillis,
  hasTimeForRetry,
  isLambdaEnvironment,
  LambdaTimeoutGuard,
  setLambdaContext,
} from './libs/LambdaTimeoutGuard';

/**
 * Metadata type stored for recovery methods registered with `@Recover`.
 */
export type { RecoverMetadata } from './libs/Recover';

/**
 * Recovery decorator and lookup helpers for fallback methods after retry exhaustion.
 */
export { findRecoverMethod, getRecoverMethods, Recover } from './libs/Recover';

/**
 * Options for configuring the `@Retryable` method decorator.
 */
export type { CircuitIdResolverContext, RetryableOptions } from './libs/Retryable';

/**
 * Method decorator that applies declarative retry behavior.
 */
export { Retryable } from './libs/Retryable';

/**
 * Runtime context object that tracks retry attempts, arguments, and the last failure.
 */
export { RetryContext } from './libs/RetryContext';

/**
 * Low-level retry loop executor used by higher-level retry abstractions.
 */
export { executeRetryLoop } from './libs/RetryEngine';

/**
 * Listener contract for observing retry lifecycle events.
 */
export type { RetryListener } from './libs/RetryListener';

/**
 * Built-in retry listeners for composing callbacks and emitting logs.
 */
export { CompositeRetryListener, LoggingRetryListener } from './libs/RetryListener';

/**
 * Options for configuring the shared retry orchestrator.
 */
export type { RetryOrchestratorOptions } from './libs/RetryOrchestrator';

/**
 * Shared orchestrator that wires policies, backoff, listeners, and recovery handling.
 */
export { RetryOrchestrator } from './libs/RetryOrchestrator';

/**
 * Retry policy contracts and configuration types.
 */
export type { RetryPolicy, RetryPolicyOptions } from './libs/RetryPolicy';

/**
 * Default retry policy implementation and built-in policy constants.
 */
export { DEFAULT_NO_RETRY_FOR, DEFAULT_RETRYABLE_CATEGORIES, DefaultRetryPolicy } from './libs/RetryPolicy';

/**
 * Callback types and options for programmatic retry execution.
 */
export type { RecoveryCallback, RetryCallback, RetryTemplateOptions } from './libs/RetryTemplate';

/**
 * Programmatic retry template for executing operations with retry and recovery callbacks.
 */
export { RetryTemplate } from './libs/RetryTemplate';
