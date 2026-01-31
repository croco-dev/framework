import type { BillingAccount, Order, ProcessedWebhook, Subscription } from '../types';
import type { BillingStore } from './BillingStore';

/**
 * In-memory billing store for testing and development.
 * NOT suitable for production multi-instance deployments.
 */
export class InMemoryBillingStore implements BillingStore {
  private readonly accounts = new Map<string, BillingAccount>();
  private readonly accountsByExternalId = new Map<string, BillingAccount>();
  private readonly subscriptions = new Map<string, Subscription>();
  private readonly subscriptionsByExternalId = new Map<string, Subscription>();
  private readonly orders = new Map<string, Order[]>();
  private readonly processedWebhooks = new Set<string>();

  async findAccountByTenantId(tenantId: string): Promise<BillingAccount | null> {
    return this.accounts.get(tenantId) ?? null;
  }

  async findAccountByExternalId(externalCustomerId: string): Promise<BillingAccount | null> {
    return this.accountsByExternalId.get(externalCustomerId) ?? null;
  }

  async saveAccount(account: BillingAccount): Promise<void> {
    this.accounts.set(account.id, account);
    this.accountsByExternalId.set(account.externalCustomerId, account);
  }

  async findSubscription(billingAccountId: string): Promise<Subscription | null> {
    return this.subscriptions.get(billingAccountId) ?? null;
  }

  async findSubscriptionByExternalId(externalSubscriptionId: string): Promise<Subscription | null> {
    return this.subscriptionsByExternalId.get(externalSubscriptionId) ?? null;
  }

  async saveSubscription(subscription: Subscription): Promise<void> {
    this.subscriptions.set(subscription.billingAccountId, subscription);
    this.subscriptionsByExternalId.set(subscription.externalSubscriptionId, subscription);
  }

  async saveOrder(order: Order): Promise<void> {
    const existing = this.orders.get(order.billingAccountId) ?? [];
    existing.push(order);
    this.orders.set(order.billingAccountId, existing);
  }

  async findOrdersByAccount(billingAccountId: string): Promise<Order[]> {
    return this.orders.get(billingAccountId) ?? [];
  }

  async isWebhookProcessed(eventId: string): Promise<boolean> {
    return this.processedWebhooks.has(eventId);
  }

  async markWebhookProcessed(webhook: ProcessedWebhook): Promise<void> {
    this.processedWebhooks.add(webhook.eventId);
  }

  /**
   * Clear all data (for testing)
   */
  reset(): void {
    this.accounts.clear();
    this.accountsByExternalId.clear();
    this.subscriptions.clear();
    this.subscriptionsByExternalId.clear();
    this.orders.clear();
    this.processedWebhooks.clear();
  }
}
