import type { BillingAccount, Order, Subscription } from "../types";

/**
 * Abstract storage for billing data.
 * The framework provides `InMemoryBillingStore`; applications may supply persistent adapters.
 */
export abstract class BillingStore {
  // BillingAccount
  abstract findAccountByTenantId(tenantId: string): Promise<BillingAccount | null>;
  abstract findAccountByExternalId(externalCustomerId: string): Promise<BillingAccount | null>;
  abstract saveAccount(account: BillingAccount): Promise<void>;
  abstract deleteAccount(billingAccountId: string): Promise<void>;

  // Subscription
  abstract findSubscription(billingAccountId: string): Promise<Subscription | null>;
  abstract findSubscriptionByExternalId(
    externalSubscriptionId: string,
  ): Promise<Subscription | null>;
  abstract saveSubscription(subscription: Subscription): Promise<void>;
  abstract deleteSubscription(billingAccountId: string): Promise<void>;

  // Order
  abstract saveOrder(order: Order): Promise<void>;
  abstract findOrdersByAccount(billingAccountId: string): Promise<Order[]>;

  // Idempotency
  /**
   * Reserves a provider webhook event for processing.
   *
   * Store adapters must throw `WebhookAlreadyProcessedProblem` only when the exact event ID
   * reservation already exists. Other storage failures must retain their original failure semantics.
   */
  abstract reserveWebhook(eventId: string, eventType: string): Promise<void>;
  abstract completeWebhook(eventId: string): Promise<void>;
  /**
   * Idempotently removes a webhook reservation in either reserved or completed state.
   *
   * This operation must also succeed when no reservation exists so recovery work can be retried
   * independently of domain-state persistence.
   */
  abstract failWebhook(eventId: string): Promise<void>;
}
