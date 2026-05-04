import type { BillingAccount, Order, ProcessedWebhook, Subscription } from '../types';

/**
 * Abstract storage for billing data.
 * Implementations: InMemoryBillingStore, DrizzleBillingStore
 */
export abstract class BillingStore {
  // BillingAccount
  abstract findAccountByTenantId(tenantId: string): Promise<BillingAccount | null>;
  abstract findAccountByExternalId(externalCustomerId: string): Promise<BillingAccount | null>;
  abstract saveAccount(account: BillingAccount): Promise<void>;
  abstract deleteAccount(billingAccountId: string): Promise<void>;

  // Subscription
  abstract findSubscription(billingAccountId: string): Promise<Subscription | null>;
  abstract findSubscriptionByExternalId(externalSubscriptionId: string): Promise<Subscription | null>;
  abstract saveSubscription(subscription: Subscription): Promise<void>;
  abstract deleteSubscription(billingAccountId: string): Promise<void>;

  // Order
  abstract saveOrder(order: Order): Promise<void>;
  abstract findOrdersByAccount(billingAccountId: string): Promise<Order[]>;

  // Idempotency
  abstract reserveWebhook(eventId: string, eventType: string): Promise<void>;
  abstract completeWebhook(eventId: string): Promise<void>;
  abstract failWebhook(eventId: string): Promise<void>;

  /** @deprecated Use reserveWebhook and completeWebhook instead. */
  abstract isWebhookProcessed(eventId: string): Promise<boolean>;

  /** @deprecated Use reserveWebhook and completeWebhook instead. */
  abstract markWebhookProcessed(webhook: ProcessedWebhook): Promise<void>;
}
