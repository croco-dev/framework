import type {
  BillingAccount,
  BillingLifecycleCommand,
  BillingLifecycleLocalResult,
  BillingLifecycleSubscriptionResolution,
  Order,
  Subscription,
} from "../types";

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
  /**
   * Applies a lifecycle target while the stored external subscription identity still matches the
   * command. Implementations must atomically rebase the lifecycle delta onto a newer snapshot of
   * that same external subscription. A `null` target atomically removes the matching subscription
   * and account.
   *
   * Implementations must return `superseded` without mutation only when a different external
   * subscription occupies the billing account.
   */
  abstract reconcileLifecycleSubscription(
    command: BillingLifecycleCommand,
    target: Subscription | null,
  ): Promise<BillingLifecycleLocalResult>;
  /**
   * Atomically resolves the subscription state for a pending lifecycle projection.
   *
   * Implementations must verify the command revision and pending state in the same operation that
   * reads and classifies the subscription. The result must carry either the latest same-identity
   * projection base or the authoritative replacement/absent state so callers never perform a
   * second, racy subscription read.
   */
  abstract resolveLifecycleSubscription(
    command: BillingLifecycleCommand,
  ): Promise<BillingLifecycleSubscriptionResolution>;

  // Subscription lifecycle commands
  /**
   * Persists a command before provider I/O.
   *
   * Implementations must return the existing command when the idempotency key and semantic
   * command fields match, reject semantic key reuse, and reject a second incomplete command for
   * the same tenant.
   */
  abstract createLifecycleCommand(
    command: BillingLifecycleCommand,
  ): Promise<BillingLifecycleCommand>;
  abstract findLifecycleCommand(idempotencyKey: string): Promise<BillingLifecycleCommand | null>;
  abstract findPendingLifecycleCommandByTenantId(
    tenantId: string,
  ): Promise<BillingLifecycleCommand | null>;
  /**
   * Saves failure evidence or advances a command monotonically through
   * `pending_provider` -> `pending_local` -> optional `pending_event` -> `completed`.
   *
   * `command.revision` is the expected current revision. Implementations must compare and increment
   * it atomically, reject stale writes, semantic mutations, invalid transitions, and attempts to
   * reopen or rewrite a completed command. Once local reconciliation runs, the command's
   * `localResult` must be persisted as durable convergence evidence.
   */
  abstract saveLifecycleCommand(command: BillingLifecycleCommand): Promise<BillingLifecycleCommand>;
  /**
   * Atomically claims event delivery for the expected command revision.
   *
   * Implementations must return `null` when the command is no longer `pending_event`, the revision
   * is stale, or another unexpired delivery lease exists. A successful claim increments the
   * revision and persists a lease computed from datastore-authoritative time.
   */
  abstract claimLifecycleEventDelivery(
    command: BillingLifecycleCommand,
    leaseDurationMs: number,
  ): Promise<BillingLifecycleCommand | null>;
  abstract listPendingLifecycleCommands(limit: number): Promise<BillingLifecycleCommand[]>;

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
