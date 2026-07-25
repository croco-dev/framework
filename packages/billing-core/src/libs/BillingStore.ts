import type {
  BillingAccount,
  LegacySubscription,
  Order,
  Subscription,
  SubscriptionPlanVersionMigration,
} from "../types";
import type { PlanRegistry } from "./PlanRegistry";
import {
  SubscriptionPlanVersionMigrationProblem,
  SubscriptionPlanVersionResolutionProblem,
} from "./problems/BillingProblems";

/**
 * Abstract storage for billing data.
 * The framework provides `InMemoryBillingStore`; applications may supply persistent adapters.
 */
export abstract class BillingStore {
  protected constructor(private readonly planRegistry: PlanRegistry) {}

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
  async saveSubscription(subscription: Subscription): Promise<void> {
    await this.requirePublishedPlanVersion(
      subscription.externalSubscriptionId,
      subscription.planId,
      subscription.planVersionRef,
      false,
    );
    await this.persistSubscription(subscription);
  }
  protected abstract persistSubscription(subscription: Subscription): Promise<void>;
  abstract deleteSubscription(billingAccountId: string): Promise<void>;
  /**
   * Returns only persisted records that predate plan-version pinning.
   */
  abstract findLegacySubscriptions(): Promise<LegacySubscription[]>;
  /**
   * Atomically pins one legacy record to the caller-selected version.
   * Adapters must not infer the latest version.
   */
  async migrateSubscriptionPlanVersion(
    migration: SubscriptionPlanVersionMigration,
  ): Promise<Subscription> {
    await this.requirePublishedPlanVersion(
      migration.externalSubscriptionId,
      migration.planId,
      migration.planVersionRef,
      true,
    );
    return this.persistSubscriptionPlanVersionMigration(migration);
  }
  protected abstract persistSubscriptionPlanVersionMigration(
    migration: SubscriptionPlanVersionMigration,
  ): Promise<Subscription>;

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
  abstract failWebhook(eventId: string): Promise<void>;

  private async requirePublishedPlanVersion(
    externalSubscriptionId: string,
    planId: string,
    planVersionRef: Subscription["planVersionRef"],
    migration: boolean,
  ): Promise<void> {
    const planVersion = await this.planRegistry.getPlanVersion(planVersionRef);
    const reason = !planVersion
      ? `plan version '${planVersionRef}' is not published`
      : planVersion.planId !== planId
        ? `plan version '${planVersionRef}' belongs to plan '${planVersion.planId}'`
        : null;
    if (!reason) {
      return;
    }
    if (migration) {
      throw new SubscriptionPlanVersionMigrationProblem(externalSubscriptionId, reason);
    }
    throw new SubscriptionPlanVersionResolutionProblem(externalSubscriptionId, reason);
  }
}
