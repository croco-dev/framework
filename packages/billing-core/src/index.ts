/**
 * @packageDocumentation
 *
 * Billing Core Module
 *
 * Core billing domain logic including billing accounts, subscriptions, orders, and payment processing.
 * Provides abstract interfaces for billing gateway, service, and store implementations.
 *
 * @module @croco/billing-core
 *
 * @example
 * ```typescript
 * import type { BillingGateway } from '@croco/billing-core';
 * import { BillingService, InMemoryBillingStore } from '@croco/billing-core';
 *
 * const store = new InMemoryBillingStore();
 * const gateway = {} as BillingGateway;
 * const service = new BillingService({ store, gateway });
 * ```
 */

// Gateway
/**
 * Billing gateway interface and types for external payment provider integration.
 *
 * @example
 * ```typescript
 * import { BillingGateway, CreateCheckoutParams, CheckoutResult } from '@croco/billing-core';
 *
 * class MyGateway implements BillingGateway {
 *   async createCheckout(params: CreateCheckoutParams): Promise<CheckoutResult> {
 *     // Implementation
 *   }
 * }
 * ```
 */
export type { BillingGateway, CheckoutResult, CreateCheckoutParams } from './libs/BillingGateway';
/**
 * Dependencies required for billing service initialization.
 */
export type { BillingServiceDependencies, CreateBillingCheckoutParams } from './libs/BillingService';

// Service
/**
 * Core billing service for managing billing accounts, subscriptions, and orders.
 *
 * @example
 * ```typescript
 * import type { BillingGateway } from '@croco/billing-core';
 * import { BillingService, InMemoryBillingStore } from '@croco/billing-core';
 *
 * const store = new InMemoryBillingStore();
 * const gateway = {} as BillingGateway;
 * const service = new BillingService({ store, gateway });
 *
 * const checkout = await service.createCheckout({
 *   tenantId: 'tenant-123',
 *   email: 'owner@example.com',
 *   successUrl: 'https://example.com/billing/success',
 *   cancelUrl: 'https://example.com/billing/cancel',
 * });
 * console.log(checkout.checkoutUrl);
 * ```
 */
export { BillingService } from './libs/BillingService';

// Store
/**
 * Billing store interface for persisting billing entities.
 *
 * @example
 * ```typescript
 * import { BillingStore } from '@croco/billing-core';
 *
 * class MyBillingStore implements BillingStore {
 *   async saveAccount(account: BillingAccount): Promise<void> {
 *     // Implementation
 *   }
 * }
 * ```
 */
export { BillingStore } from './libs/BillingStore';

// Events
/**
 * Domain event emitted when an order is successfully paid.
 *
 * @example
 * ```typescript
 * import { OrderPaidEvent } from '@croco/billing-core';
 *
 * const event = new OrderPaidEvent({
 *   orderId: 'order_123',
 *   accountId: 'account_456',
 *   amount: 2999,
 *   currency: 'USD'
 * });
 * ```
 */
export { OrderPaidEvent } from './libs/events/OrderPaidEvent';
/**
 * Domain event emitted when a subscription plan is changed.
 *
 * @example
 * ```typescript
 * import { PlanChangedEvent } from '@croco/billing-core';
 *
 * const event = new PlanChangedEvent({
 *   accountId: 'account_456',
 *   previousPlanId: 'pro-plan',
 *   newPlanId: 'enterprise-plan'
 * });
 * ```
 */
export { PlanChangedEvent } from './libs/events/PlanChangedEvent';
/**
 * Domain event emitted when a subscription is activated.
 *
 * @example
 * ```typescript
 * import { SubscriptionActivatedEvent } from '@croco/billing-core';
 *
 * const event = new SubscriptionActivatedEvent({
 *   accountId: 'account_456',
 *   subscriptionId: 'sub_789',
 *   planId: 'pro-plan'
 * });
 * ```
 */
export { SubscriptionActivatedEvent } from './libs/events/SubscriptionActivatedEvent';
/**
 * Domain event emitted when a subscription is canceled.
 *
 * @example
 * ```typescript
 * import { SubscriptionCanceledEvent } from '@croco/billing-core';
 *
 * const event = new SubscriptionCanceledEvent({
 *   accountId: 'account_456',
 *   subscriptionId: 'sub_789'
 * });
 * ```
 */
export { SubscriptionCanceledEvent } from './libs/events/SubscriptionCanceledEvent';
/**
 * Domain event emitted when a subscription becomes past due.
 *
 * @example
 * ```typescript
 * import { SubscriptionPastDueEvent } from '@croco/billing-core';
 *
 * const event = new SubscriptionPastDueEvent({
 *   accountId: 'account_456',
 *   subscriptionId: 'sub_789',
 *   overdueSince: new Date()
 * });
 * ```
 */
export { SubscriptionPastDueEvent } from './libs/events/SubscriptionPastDueEvent';
/**
 * Domain event emitted when a subscription is revoked.
 *
 * @example
 * ```typescript
 * import { SubscriptionRevokedEvent } from '@croco/billing-core';
 *
 * const event = new SubscriptionRevokedEvent({
 *   accountId: 'account_456',
 *   subscriptionId: 'sub_789',
 *   reason: 'fraud'
 * });
 * ```
 */
export { SubscriptionRevokedEvent } from './libs/events/SubscriptionRevokedEvent';

/**
 * In-memory implementation of billing store for testing and development.
 *
 * @example
 * ```typescript
 * import { InMemoryBillingStore } from '@croco/billing-core';
 *
 * const store = new InMemoryBillingStore();
 * await store.saveAccount(account);
 * ```
 */
export { InMemoryBillingStore } from './libs/InMemoryBillingStore';
/**
 * Plan registry interface for managing available subscription plans.
 *
 * @example
 * ```typescript
 * import { PlanRegistry } from '@croco/billing-core';
 *
 * const registry: PlanRegistry = {
 *   'pro-plan': { id: 'pro-plan', name: 'Pro', price: 2999, currency: 'USD' },
 *   'enterprise-plan': { id: 'enterprise-plan', name: 'Enterprise', price: 9999, currency: 'USD' }
 * };
 * ```
 */
export type { PlanRegistry } from './libs/PlanRegistry';

/**
 * Problem details for billing-related errors.
 *
 * @example
 * ```typescript
 * import { BillingAccountNotFoundProblem, SubscriptionNotFoundProblem } from '@croco/billing-core';
 *
 * throw new BillingAccountNotFoundProblem('user-123');
 * throw new SubscriptionNotFoundProblem('sub-456');
 * ```
 */
export {
  BillingAccountNotFoundProblem,
  BillingCheckoutCreationProblem,
  SubscriptionNotFoundProblem,
  WebhookAlreadyProcessedProblem,
} from './libs/problems/BillingProblems';

// Types
/**
 * Core domain types for billing accounts, orders, plans, and subscriptions.
 *
 * @example
 * ```typescript
 * import type {
 *   BillingAccount,
 *   Order,
 *   Plan,
 *   PlanInterval,
 *   ProcessedWebhook,
 *   Subscription,
 *   SubscriptionStatus
 * } from '@croco/billing-core';
 *
 * const account: BillingAccount = {
 *   id: 'acc_123',
 *   userId: 'user-456',
 *   currentPlanId: 'pro-plan',
 *   status: 'active'
 * };
 * ```
 */
export type {
  BillingAccount,
  Order,
  Plan,
  PlanInterval,
  ProcessedWebhook,
  Subscription,
  SubscriptionStatus,
} from './types';
