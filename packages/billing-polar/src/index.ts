/**
 * @packageDocumentation
 *
 * Billing Polar Integration Module
 *
 * Polar payment provider integration for the Croco billing system.
 * Provides gateway implementation, webhook handling, and event mapping for Polar.
 *
 * @module @croco/billing-polar
 *
 * @example
 * ```typescript
 * import { PolarBillingGateway, PolarConfig } from '@croco/billing-polar';
 *
 * const config: PolarConfig = {
 *   apiKey: 'pol_live_...',
 *   webhookSecret: 'whsec_...'
 * };
 *
 * const gateway = new PolarBillingGateway(config);
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
 *   apiKey: 'pol_live_...',
 *   webhookSecret: 'whsec_...',
 *   apiUrl: 'https://api.polar.sh'
 * };
 *
 * const gateway = new PolarBillingGateway(config);
 * const checkout = await gateway.createCheckout({
 *   productId: 'prod_123',
 *   amount: 2999,
 *   currency: 'USD'
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
 *   mapper: new PolarEventMapper(),
 *   eventBus: myEventBus,
 *   secret: 'whsec_...'
 * });
 *
 * const result = await handler.handle(rawPayload, signature);
 * ```
 */
export { PolarWebhookHandler } from "./libs/PolarWebhookHandler";

// Types
/**
 * Configuration types and handler results for Polar integration.
 *
 * @example
 * ```typescript
 * import type { PolarConfig, WebhookHandlerResult } from '@croco/billing-polar';
 *
 * const config: PolarConfig = {
 *   apiKey: 'pol_live_...',
 *   webhookSecret: 'whsec_...',
 *   apiUrl: 'https://api.polar.sh'
 * };
 *
 * const result: WebhookHandlerResult = {
 *   success: true,
 *   processedEvents: 5
 * };
 * ```
 */
export type { PolarConfig, WebhookHandlerResult } from "./types";
