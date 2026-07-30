/**
 * @packageDocumentation
 *
 * Billing Polar Integration Module
 *
 * Polar payment provider integration for the Croco billing system.
 * Provides gateway implementation, webhook handling, and event mapping for Polar.
 *
 * @example
 * ```typescript
 * import { PolarBillingGateway, PolarConfig } from '@croco/billing-polar';
 *
 * const config: PolarConfig = {
 *   accessToken: 'polar_access_token',
 *   environment: 'sandbox',
 *   webhookSecret: 'whsec_...'
 * };
 *
 * const gateway = new PolarBillingGateway(config, logger);
 * ```
 */

// Gateway
/**
 * Polar billing gateway implementation.
 *
 * Integrates with Polar API for checkout creation, subscription management,
 * and payment processing.
 *
 * @example
 * ```typescript
 * import { PolarBillingGateway, PolarConfig } from '@croco/billing-polar';
 *
 * const config: PolarConfig = {
 *   accessToken: 'polar_access_token',
 *   environment: 'sandbox',
 *   webhookSecret: 'whsec_...',
 * };
 *
 * const gateway = new PolarBillingGateway(config, logger);
 * const checkout = await gateway.createCheckout({
 *   billingAccountId: 'tenant_123',
 *   email: 'buyer@example.com',
 *   productId: 'prod_123',
 *   successUrl: 'https://example.com/success',
 *   idempotencyKey: 'checkout_order_123'
 * });
 * ```
 */
export { PolarBillingGateway } from "./libs/PolarBillingGateway";

// Event Mapper
/**
 * Maps Polar webhook events to Croco billing domain events.
 *
 * Converts Polar webhook payloads into typed domain events
 * (OrderPaidEvent, SubscriptionActivatedEvent, etc.).
 *
 * @example
 * ```typescript
 * import { PolarEventMapper } from '@croco/billing-polar';
 *
 * const mapper = new PolarEventMapper();
 * const polarEvent = {
 *   type: 'order.paid',
 *   data: { id: 'ord_123', amount: 2999 }
 * };
 *
 * const domainEvent = mapper.toDomainEvent(polarEvent);
 * ```
 */
export { PolarEventMapper } from "./libs/PolarEventMapper";
export { PolarBillingDiagnosticsProvider } from "./libs/PolarBillingDiagnosticsProvider";
export type {
  PolarBillingDiagnosticsOptions,
  PolarReadinessCheckContext,
  PolarReadinessCheckResult,
} from "./libs/PolarBillingDiagnosticsProvider";
/**
 * Dependencies for Polar webhook handler.
 */
export type { WebhookDependencies } from "./libs/PolarWebhookHandler";

// Webhook
/**
 * Polar webhook handler for processing incoming webhook events.
 *
 * Validates webhook signatures and delegates to event handlers.
 *
 * @example
 * ```typescript
 * import { PolarWebhookHandler, PolarEventMapper } from '@croco/billing-polar';
 *
 * const handler = new PolarWebhookHandler({
 *   accessToken: 'polar_access_token',
 *   environment: 'sandbox',
 *   webhookSecret: 'whsec_...'
 * }, {
 *   store,
 *   eventPublisher,
 *   planRegistry
 * });
 *
 * const result = await handler.handle(rawPayload, requestHeaders);
 * ```
 */
export { PolarWebhookHandler } from "./libs/PolarWebhookHandler";
export { BillingStatusMappingProblem } from "./libs/problems/BillingStatusMappingProblem";
export {
  PolarCheckoutIdempotencyConflictProblem,
  PolarCustomerNotFoundProblem,
  PolarMissingConfigProblem,
  PolarRetryableUpstreamProblem,
  PolarSubscriptionNotFoundProblem,
  PolarTerminalUpstreamProblem,
  PolarValidationProblem,
  normalizePolarBillingError,
  validatePolarConfig,
  type PolarBillingErrorContext,
  type PolarConfigKey,
} from "./libs/problems/PolarBillingProblems";
export { WebhookProcessingProblem } from "./libs/problems/WebhookProcessingProblem";
export { WebhookValidationProblem } from "./libs/problems/WebhookValidationProblem";

// Types
/**
 * Configuration types and handler results for Polar integration.
 *
 * @example
 * ```typescript
 * import type { PolarConfig, WebhookHandlerResult } from '@croco/billing-polar';
 *
 * const config: PolarConfig = {
 *   accessToken: 'polar_access_token',
 *   environment: 'sandbox',
 *   webhookSecret: 'whsec_...',
 * };
 *
 * const result: WebhookHandlerResult = {
 *   success: true,
 *   eventId: 'evt_123'
 * };
 * ```
 */
export type { PolarConfig, WebhookHandlerResult } from "./types";
