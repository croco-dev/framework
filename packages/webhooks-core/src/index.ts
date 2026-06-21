/**
 * @packageDocumentation
 *
 * Provider-neutral webhook gateway contracts for signature verification, typed dispatch,
 * idempotent replay, and local fixture reproduction.
 */

export { WebhookEventRouter, createWebhookEventRouter } from "./libs/WebhookEventRouter";
export { WebhookGateway, createWebhookGateway } from "./libs/WebhookGateway";
export {
  createWebhookReplayFixture,
  loadWebhookReplayFixture,
  parseWebhookReplayFixture,
} from "./libs/fixture";
export {
  createWebhookProviderAdapterConformanceSuite,
  type WebhookProviderAdapterConformanceCase,
  type WebhookProviderAdapterConformanceOptions,
  type WebhookProviderAdapterConformanceSuite,
} from "./libs/conformance";
export { normalizeWebhookHeaders } from "./libs/headers";
export {
  WEBHOOK_DIAGNOSTIC_CODES,
  DuplicateWebhookEventProblem,
  InvalidWebhookEnvelopeProblem,
  InvalidWebhookFixtureProblem,
  InvalidWebhookSignatureProblem,
  UnknownWebhookEventProblem,
  WebhookDispatchProblem,
  WebhookGatewayConfigurationProblem,
  WebhookReporterProblem,
} from "./libs/problems/WebhookProblems";
export type { WebhookDiagnosticCode } from "./libs/problems/WebhookProblems";
export type {
  NormalizedWebhookHeaders,
  UnknownEventPolicy,
  WebhookDispatchContext,
  WebhookDispatchResult,
  WebhookEvent,
  WebhookEventCatalog,
  WebhookEventDefinition,
  WebhookEventHandler,
  WebhookGatewayHandledResult,
  WebhookGatewayIdempotentResult,
  WebhookGatewayIgnoredResult,
  WebhookGatewayOptions,
  WebhookGatewayReplayFixture,
  WebhookGatewayRequest,
  WebhookGatewayResult,
  WebhookGatewayStoredResult,
  WebhookHeaders,
  WebhookProviderAdapter,
  WebhookRawBody,
  WebhookUnknownEventReporter,
} from "./libs/types";
export { InMemoryIdempotencyStore } from "@croco/idempotency-core";
export type {
  DerivedIdempotencyKey,
  IdempotencyStore,
  IdempotencyCompletedRecord,
  IdempotencyFailedRecord,
  IdempotencyInFlightRecord,
} from "@croco/idempotency-core";
