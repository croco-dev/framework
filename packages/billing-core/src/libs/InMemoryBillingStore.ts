import type {
  BillingAccount,
  LegacySubscription,
  Order,
  Subscription,
  SubscriptionPlanVersionMigration,
} from "../types";
import { BillingStore } from "./BillingStore";
import type { PlanRegistry } from "./PlanRegistry";
import {
  SubscriptionNotFoundProblem,
  SubscriptionPlanVersionMigrationProblem,
  SubscriptionPlanVersionMigrationRequiredProblem,
  SubscriptionPlanVersionImmutableProblem,
  WebhookAlreadyProcessedProblem,
} from "./problems/BillingProblems";

type WebhookState = "RESERVED" | "COMPLETED";

/**
 * In-memory billing store for testing and development.
 * NOT suitable for production multi-instance deployments.
 */
export class InMemoryBillingStore extends BillingStore {
  private readonly accounts = new Map<string, BillingAccount>();
  private readonly accountsByTenantId = new Map<string, BillingAccount>();
  private readonly accountsByExternalId = new Map<string, BillingAccount>();
  private readonly subscriptions = new Map<string, Subscription | LegacySubscription>();
  private readonly subscriptionsByExternalId = new Map<string, Subscription | LegacySubscription>();
  private readonly orders = new Map<string, Order[]>();
  private readonly processedWebhooks = new Map<string, WebhookState>();

  constructor(planRegistry: PlanRegistry) {
    super(planRegistry);
  }

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
    return this.requirePinned(this.subscriptions.get(billingAccountId));
  }

  async findSubscriptionByExternalId(externalSubscriptionId: string): Promise<Subscription | null> {
    return this.requirePinned(this.subscriptionsByExternalId.get(externalSubscriptionId));
  }

  protected async persistSubscription(subscription: Subscription): Promise<void> {
    const existingSubscription = this.subscriptions.get(subscription.billingAccountId);
    if (existingSubscription && !("planVersionRef" in existingSubscription)) {
      throw new SubscriptionPlanVersionMigrationRequiredProblem(
        existingSubscription.externalSubscriptionId,
      );
    }
    if (
      existingSubscription &&
      (existingSubscription.planVersionRef !== subscription.planVersionRef ||
        existingSubscription.planId !== subscription.planId)
    ) {
      throw new SubscriptionPlanVersionImmutableProblem(
        subscription.externalSubscriptionId,
        `${existingSubscription.planId}:${existingSubscription.planVersionRef}`,
        `${subscription.planId}:${subscription.planVersionRef}`,
      );
    }

    if (
      existingSubscription &&
      existingSubscription.externalSubscriptionId !== subscription.externalSubscriptionId
    ) {
      this.subscriptionsByExternalId.delete(existingSubscription.externalSubscriptionId);
    }

    const snapshot = this.snapshotSubscription(subscription);
    this.subscriptions.set(snapshot.billingAccountId, snapshot);
    this.subscriptionsByExternalId.set(snapshot.externalSubscriptionId, snapshot);
  }

  async deleteSubscription(billingAccountId: string): Promise<void> {
    const subscription = this.subscriptions.get(billingAccountId);

    if (!subscription) {
      return;
    }

    this.subscriptions.delete(billingAccountId);
    this.subscriptionsByExternalId.delete(subscription.externalSubscriptionId);
  }

  /**
   * Loads a pre-plan-version record for migration tests and development fixtures.
   * New application writes must use saveSubscription with a pinned Subscription.
   */
  importLegacySubscription(subscription: LegacySubscription): void {
    const snapshot = this.snapshotSubscription(subscription);
    this.subscriptions.set(snapshot.billingAccountId, snapshot);
    this.subscriptionsByExternalId.set(snapshot.externalSubscriptionId, snapshot);
  }

  async findLegacySubscriptions(): Promise<LegacySubscription[]> {
    return [...this.subscriptions.values()]
      .filter(
        (subscription): subscription is LegacySubscription => !("planVersionRef" in subscription),
      )
      .map((subscription) => this.cloneSubscription(subscription));
  }

  protected async persistSubscriptionPlanVersionMigration(
    migration: SubscriptionPlanVersionMigration,
  ): Promise<Subscription> {
    const persisted = this.subscriptionsByExternalId.get(migration.externalSubscriptionId);
    if (!persisted) {
      throw new SubscriptionNotFoundProblem(migration.externalSubscriptionId);
    }
    if ("planVersionRef" in persisted) {
      throw new SubscriptionPlanVersionMigrationProblem(
        migration.externalSubscriptionId,
        "a plan version is already pinned",
      );
    }
    if (persisted.planId !== migration.planId) {
      throw new SubscriptionPlanVersionMigrationProblem(
        migration.externalSubscriptionId,
        `stored plan '${persisted.planId}' does not match requested plan '${migration.planId}'`,
      );
    }
    if (this.subscriptionsByExternalId.get(migration.externalSubscriptionId) !== persisted) {
      throw new SubscriptionPlanVersionMigrationProblem(
        migration.externalSubscriptionId,
        "the stored subscription changed during migration",
      );
    }

    const migrated: Subscription = {
      ...persisted,
      planVersionRef: migration.planVersionRef,
    };
    const snapshot = this.snapshotSubscription(migrated);
    this.subscriptions.set(snapshot.billingAccountId, snapshot);
    this.subscriptionsByExternalId.set(snapshot.externalSubscriptionId, snapshot);
    return this.cloneSubscription(snapshot);
  }

  async saveOrder(order: Order): Promise<void> {
    const existing = this.orders.get(order.billingAccountId) ?? [];
    existing.push(order);
    this.orders.set(order.billingAccountId, existing);
  }

  async findOrdersByAccount(billingAccountId: string): Promise<Order[]> {
    return this.orders.get(billingAccountId) ?? [];
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

  private requirePinned(
    subscription: Subscription | LegacySubscription | undefined,
  ): Subscription | null {
    if (!subscription) {
      return null;
    }
    if (!("planVersionRef" in subscription)) {
      throw new SubscriptionPlanVersionMigrationRequiredProblem(
        subscription.externalSubscriptionId,
      );
    }
    return this.cloneSubscription(subscription);
  }

  private snapshotSubscription<T extends Subscription | LegacySubscription>(subscription: T): T {
    return Object.freeze(this.cloneSubscription(subscription)) as T;
  }

  private cloneSubscription<T extends Subscription | LegacySubscription>(subscription: T): T {
    return structuredClone(subscription);
  }
}
