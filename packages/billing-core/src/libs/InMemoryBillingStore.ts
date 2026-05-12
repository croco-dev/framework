import type { BillingAccount, Order, ProcessedWebhook, Subscription } from "../types";
import { BillingStore } from "./BillingStore";
import { WebhookAlreadyProcessedProblem } from "./problems/BillingProblems";

type WebhookState = "RESERVED" | "COMPLETED";

/**
 * In-memory billing store for testing and development.
 * NOT suitable for production multi-instance deployments.
 */
export class InMemoryBillingStore extends BillingStore {
  private readonly accounts = new Map<string, BillingAccount>();
  private readonly accountsByTenantId = new Map<string, BillingAccount>();
  private readonly accountsByExternalId = new Map<string, BillingAccount>();
  private readonly subscriptions = new Map<string, Subscription>();
  private readonly subscriptionsByExternalId = new Map<string, Subscription>();
  private readonly orders = new Map<string, Order[]>();
  private readonly processedWebhooks = new Map<string, WebhookState>();

  async findAccountByTenantId(tenantId: string): Promise<BillingAccount | null> {
    return this.accountsByTenantId.get(tenantId) ?? null;
  }

  async findAccountByExternalId(externalCustomerId: string): Promise<BillingAccount | null> {
    return this.accountsByExternalId.get(externalCustomerId) ?? null;
  }

  async saveAccount(account: BillingAccount): Promise<void> {
    const existingAccount = this.accounts.get(account.id);

    if (existingAccount && existingAccount.externalCustomerId !== account.externalCustomerId) {
      this.accountsByExternalId.delete(existingAccount.externalCustomerId);
    }

    this.accounts.set(account.id, account);
    this.accountsByTenantId.set(account.tenantId, account);
    this.accountsByExternalId.set(account.externalCustomerId, account);
  }

  async deleteAccount(billingAccountId: string): Promise<void> {
    const account = this.accounts.get(billingAccountId);

    if (!account) {
      return;
    }

    this.accounts.delete(billingAccountId);
    this.accountsByTenantId.delete(account.tenantId);
    this.accountsByExternalId.delete(account.externalCustomerId);
  }

  async findSubscription(billingAccountId: string): Promise<Subscription | null> {
    return this.subscriptions.get(billingAccountId) ?? null;
  }

  async findSubscriptionByExternalId(externalSubscriptionId: string): Promise<Subscription | null> {
    return this.subscriptionsByExternalId.get(externalSubscriptionId) ?? null;
  }

  async saveSubscription(subscription: Subscription): Promise<void> {
    const existingSubscription = this.subscriptions.get(subscription.billingAccountId);

    if (
      existingSubscription &&
      existingSubscription.externalSubscriptionId !== subscription.externalSubscriptionId
    ) {
      this.subscriptionsByExternalId.delete(existingSubscription.externalSubscriptionId);
    }

    this.subscriptions.set(subscription.billingAccountId, subscription);
    this.subscriptionsByExternalId.set(subscription.externalSubscriptionId, subscription);
  }

  async deleteSubscription(billingAccountId: string): Promise<void> {
    const subscription = this.subscriptions.get(billingAccountId);

    if (!subscription) {
      return;
    }

    this.subscriptions.delete(billingAccountId);
    this.subscriptionsByExternalId.delete(subscription.externalSubscriptionId);
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
    return this.processedWebhooks.get(eventId) === "COMPLETED";
  }

  async markWebhookProcessed(webhook: ProcessedWebhook): Promise<void> {
    await this.reserveWebhook(webhook.eventId, webhook.eventType);
    await this.completeWebhook(webhook.eventId);
  }

  async reserveWebhook(eventId: string, _eventType: string): Promise<void> {
    if (this.processedWebhooks.has(eventId)) {
      throw new WebhookAlreadyProcessedProblem(eventId);
    }

    this.processedWebhooks.set(eventId, "RESERVED");
  }

  async completeWebhook(eventId: string): Promise<void> {
    if (this.processedWebhooks.get(eventId) !== "RESERVED") {
      throw new WebhookAlreadyProcessedProblem(eventId);
    }

    this.processedWebhooks.set(eventId, "COMPLETED");
  }

  async failWebhook(eventId: string): Promise<void> {
    this.processedWebhooks.delete(eventId);
  }

  /**
   * Clear all data (for testing)
   */
  reset(): void {
    this.accounts.clear();
    this.accountsByTenantId.clear();
    this.accountsByExternalId.clear();
    this.subscriptions.clear();
    this.subscriptionsByExternalId.clear();
    this.orders.clear();
    this.processedWebhooks.clear();
  }
}
