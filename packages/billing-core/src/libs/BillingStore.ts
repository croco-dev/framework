import type { BillingAccount, Order, ProcessedWebhook, Subscription } from '../types';

/**
 * Abstract storage interface for billing data.
 * Implementations: InMemoryBillingStore, DrizzleBillingStore
 */
export interface BillingStore {
  // BillingAccount
  findAccountByTenantId(tenantId: string): Promise<BillingAccount | null>;
  findAccountByExternalId(externalCustomerId: string): Promise<BillingAccount | null>;
  saveAccount(account: BillingAccount): Promise<void>;

  // Subscription
  findSubscription(billingAccountId: string): Promise<Subscription | null>;
  findSubscriptionByExternalId(externalSubscriptionId: string): Promise<Subscription | null>;
  saveSubscription(subscription: Subscription): Promise<void>;

  // Order
  saveOrder(order: Order): Promise<void>;
  findOrdersByAccount(billingAccountId: string): Promise<Order[]>;

  // Idempotency
  isWebhookProcessed(eventId: string): Promise<boolean>;
  markWebhookProcessed(webhook: ProcessedWebhook): Promise<void>;
}
