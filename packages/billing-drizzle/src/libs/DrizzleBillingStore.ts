import { randomUUID } from "node:crypto";
import {
  BillingStore,
  BillingAccountTenantConflictProblem,
  BillingLifecycleCommandConflictProblem,
  BillingLifecycleCommandInProgressProblem,
  WebhookAlreadyProcessedProblem,
  WebhookEventIntentsPendingProblem,
} from "@croco/billing-core";
import { sql } from "drizzle-orm";
import { atomic, now, read, remove, write } from "./Persistence";
import type { BillingDatabase } from "./Persistence";
import type {
  BillingAccount,
  Subscription,
  Order,
  BillingLifecycleCommand,
  BillingLifecycleLocalResult,
  BillingLifecycleSubscriptionResolution,
  BillingSubscriptionWebhookTransition,
  BillingWebhookDeliveryClaim,
  CommitBillingSubscriptionWebhookInput,
} from "@croco/billing-core";

/** Required application/environment namespace for a tenant-addressed BillingService. */
export type BillingPersistenceScope = { readonly appId: string; readonly environment: string };
type Webhook = { state: "RESERVED" | "COMPLETED"; token?: string; leaseUntil?: string };

/** PostgreSQL persistence with transactional serialization across cooperating store instances. */
export class DrizzleBillingStore extends BillingStore {
  private readonly namespace: string;
  constructor(
    private readonly db: BillingDatabase,
    scope: BillingPersistenceScope,
  ) {
    super();
    this.namespace = JSON.stringify([scope.appId, scope.environment]);
  }

  async findAccountByTenantId(tenantId: string): Promise<BillingAccount | null> {
    const result = await this.db.execute<{ data: BillingAccount }>(
      sql`select data from croco_billing_accounts where namespace = ${this.namespace} and tenant_id = ${tenantId}`,
    );
    return result.rows[0] ? accountDates(result.rows[0].data) : null;
  }
  async findAccountByExternalId(externalId: string): Promise<BillingAccount | null> {
    const result = await this.db.execute<{ data: BillingAccount }>(
      sql`select data from croco_billing_accounts where namespace = ${this.namespace} and external_id = ${externalId}`,
    );
    return result.rows[0] ? accountDates(result.rows[0].data) : null;
  }
  async saveAccount(account: BillingAccount): Promise<void> {
    await atomic(this.db, this.namespace, async (tx) => {
      const existing = await tx.execute<{ data: BillingAccount }>(
        sql`select data from croco_billing_accounts where namespace = ${this.namespace} and tenant_id = ${account.tenantId}`,
      );
      if (existing.rows[0] && existing.rows[0].data.id !== account.id) {
        throw new BillingAccountTenantConflictProblem(
          account.tenantId,
          existing.rows[0].data.id,
          account.id,
        );
      }
      await write(tx, "croco_billing_accounts", this.namespace, account.id, account);
    });
  }
  async deleteAccount(id: string): Promise<void> {
    await atomic(this.db, this.namespace, (tx) =>
      remove(tx, "croco_billing_accounts", this.namespace, id),
    );
  }
  async findSubscription(accountId: string): Promise<Subscription | null> {
    const value = await read<Subscription>(
      this.db,
      "croco_billing_subscriptions",
      this.namespace,
      accountId,
    );
    return value ? subscriptionDates(value) : null;
  }
  async findSubscriptionByExternalId(externalId: string): Promise<Subscription | null> {
    const result = await this.db.execute<{ data: Subscription }>(
      sql`select data from croco_billing_subscriptions where namespace = ${this.namespace} and external_id = ${externalId}`,
    );
    return result.rows[0] ? subscriptionDates(result.rows[0].data) : null;
  }
  async saveSubscription(subscription: Subscription): Promise<void> {
    await atomic(this.db, this.namespace, (tx) =>
      write(
        tx,
        "croco_billing_subscriptions",
        this.namespace,
        subscription.billingAccountId,
        subscription,
      ),
    );
  }
  async deleteSubscription(accountId: string): Promise<void> {
    await atomic(this.db, this.namespace, (tx) =>
      remove(tx, "croco_billing_subscriptions", this.namespace, accountId),
    );
  }
  async reconcileLifecycleSubscription(
    command: BillingLifecycleCommand,
    target: Subscription | null,
  ): Promise<BillingLifecycleLocalResult> {
    return atomic(this.db, this.namespace, async (tx) => {
      const saved = await read<Subscription>(
        tx,
        "croco_billing_subscriptions",
        this.namespace,
        command.subscription.billingAccountId,
      );
      const current = saved ? subscriptionDates(saved) : null;
      if (current && current.externalSubscriptionId !== command.subscription.externalSubscriptionId)
        return "superseded";
      if (target) {
        if (!current) return "superseded";
        await write(tx, "croco_billing_subscriptions", this.namespace, current.billingAccountId, {
          ...current,
          status: command.kind === "cancel_immediately" ? "canceled" : current.status,
          cancelAtPeriodEnd: target.cancelAtPeriodEnd,
          lastSyncedAt: new Date(
            Math.max(current.lastSyncedAt.getTime(), target.lastSyncedAt.getTime()),
          ),
        });
      } else {
        await remove(
          tx,
          "croco_billing_subscriptions",
          this.namespace,
          command.subscription.billingAccountId,
        );
      }
      return "applied";
    });
  }
  async resolveLifecycleSubscription(
    command: BillingLifecycleCommand,
  ): Promise<BillingLifecycleSubscriptionResolution> {
    return atomic(this.db, this.namespace, async (tx) => {
      const stored = await read<BillingLifecycleCommand>(
        tx,
        "croco_billing_commands",
        this.namespace,
        command.idempotencyKey,
      );
      const saved = await read<Subscription>(
        tx,
        "croco_billing_subscriptions",
        this.namespace,
        command.subscription.billingAccountId,
      );
      const current = saved ? subscriptionDates(saved) : null;
      if (
        !stored ||
        stored.revision !== command.revision ||
        (stored.state !== "pending_local" && stored.state !== "pending_event") ||
        !current ||
        current.externalSubscriptionId !== command.subscription.externalSubscriptionId
      ) {
        return { kind: "current", subscription: current };
      }
      return { kind: "projection_base", subscription: current };
    });
  }
  async createLifecycleCommand(command: BillingLifecycleCommand): Promise<BillingLifecycleCommand> {
    return atomic(this.db, this.namespace, async (tx) => {
      if (command.state !== "pending_provider" || command.revision !== 0)
        throw new BillingLifecycleCommandConflictProblem(command.idempotencyKey);
      const existing = await read<BillingLifecycleCommand>(
        tx,
        "croco_billing_commands",
        this.namespace,
        command.idempotencyKey,
      );
      if (existing) {
        if (!sameIntent(existing, command))
          throw new BillingLifecycleCommandConflictProblem(command.idempotencyKey);
        return commandDates(existing);
      }
      const pending = await tx.execute<{ id: string }>(
        sql`select id from croco_billing_commands where namespace = ${this.namespace} and tenant_id = ${command.tenantId} and state <> 'completed'`,
      );
      if (pending.rows[0])
        throw new BillingLifecycleCommandInProgressProblem(command.tenantId, pending.rows[0].id);
      await write(tx, "croco_billing_commands", this.namespace, command.idempotencyKey, command);
      return commandDates(command);
    });
  }
  async findLifecycleCommand(key: string): Promise<BillingLifecycleCommand | null> {
    const value = await read<BillingLifecycleCommand>(
      this.db,
      "croco_billing_commands",
      this.namespace,
      key,
    );
    return value ? commandDates(value) : null;
  }
  async findPendingLifecycleCommandByTenantId(
    tenantId: string,
  ): Promise<BillingLifecycleCommand | null> {
    const result = await this.db.execute<{ data: BillingLifecycleCommand }>(
      sql`select data from croco_billing_commands where namespace = ${this.namespace} and tenant_id = ${tenantId} and state <> 'completed'`,
    );
    return result.rows[0] ? commandDates(result.rows[0].data) : null;
  }
  async saveLifecycleCommand(command: BillingLifecycleCommand): Promise<BillingLifecycleCommand> {
    return atomic(this.db, this.namespace, async (tx) => {
      const existing = await read<BillingLifecycleCommand>(
        tx,
        "croco_billing_commands",
        this.namespace,
        command.idempotencyKey,
      );
      if (
        !existing ||
        !sameIntent(existing, command) ||
        existing.revision !== command.revision ||
        (existing.localResult !== undefined && existing.localResult !== command.localResult) ||
        !allowed(existing.state, command.state)
      ) {
        throw new BillingLifecycleCommandConflictProblem(command.idempotencyKey);
      }
      const saved = { ...command, revision: command.revision + 1 };
      await write(tx, "croco_billing_commands", this.namespace, command.idempotencyKey, saved);
      return commandDates(saved);
    });
  }
  async claimLifecycleEventDelivery(
    command: BillingLifecycleCommand,
    leaseDurationMs: number,
  ): Promise<BillingLifecycleCommand | null> {
    return atomic(this.db, this.namespace, async (tx) => {
      const existing = await read<BillingLifecycleCommand>(
        tx,
        "croco_billing_commands",
        this.namespace,
        command.idempotencyKey,
      );
      const time = await now(tx);
      if (
        !existing ||
        existing.state !== "pending_event" ||
        existing.revision !== command.revision ||
        (existing.eventDeliveryLeaseUntil &&
          new Date(existing.eventDeliveryLeaseUntil).getTime() > time.getTime())
      )
        return null;
      const saved = {
        ...existing,
        revision: existing.revision + 1,
        eventDeliveryLeaseUntil: new Date(time.getTime() + leaseDurationMs),
        updatedAt: time,
      };
      await write(tx, "croco_billing_commands", this.namespace, command.idempotencyKey, saved);
      return commandDates(saved);
    });
  }
  async listPendingLifecycleCommands(limit: number): Promise<BillingLifecycleCommand[]> {
    if (!Number.isInteger(limit) || limit <= 0) return [];
    const result = await this.db.execute<{ data: BillingLifecycleCommand }>(
      sql`select data from croco_billing_commands where namespace = ${this.namespace} and state <> 'completed' order by (data->>'createdAt')::timestamptz, id limit ${limit}`,
    );
    return result.rows.map((row) => commandDates(row.data));
  }
  async saveOrder(order: Order): Promise<void> {
    await atomic(this.db, this.namespace, (tx) =>
      write(
        tx,
        "croco_billing_orders",
        this.namespace,
        JSON.stringify([order.billingAccountId, order.id]),
        order,
      ),
    );
  }
  async findOrdersByAccount(accountId: string): Promise<Order[]> {
    const result = await this.db.execute<{ data: Order }>(
      sql`select data from croco_billing_orders where namespace = ${this.namespace} and data->>'billingAccountId' = ${accountId} order by id`,
    );
    return result.rows.map(({ data }) => ({ ...data, paidAt: new Date(data.paidAt) }));
  }
  async commitSubscriptionWebhook(
    input: CommitBillingSubscriptionWebhookInput,
  ): Promise<BillingSubscriptionWebhookTransition> {
    return atomic(this.db, this.namespace, async (tx) => {
      const existing = await read<BillingSubscriptionWebhookTransition>(
        tx,
        "croco_billing_transitions",
        this.namespace,
        input.eventId,
      );
      if (existing) return transitionDates(existing);
      if (await read(tx, "croco_billing_webhooks", this.namespace, input.eventId))
        throw new WebhookAlreadyProcessedProblem(input.eventId);
      const saved = await read<Subscription>(
        tx,
        "croco_billing_subscriptions",
        this.namespace,
        input.subscription.billingAccountId,
      );
      const previous = saved ? subscriptionDates(saved) : null;
      const older =
        previous?.externalSubscriptionId === input.subscription.externalSubscriptionId &&
        previous.providerModifiedAt !== undefined &&
        input.subscription.providerModifiedAt !== undefined &&
        previous.providerModifiedAt.getTime() > input.subscription.providerModifiedAt.getTime();
      const transition: BillingSubscriptionWebhookTransition = {
        eventId: input.eventId,
        eventType: input.eventType,
        previousSubscription: previous,
        subscription: input.subscription,
        intents: older
          ? []
          : input.createEventIntents(previous).map((event) => ({ event, publishedAt: null })),
        state: "pending",
      };
      if (!older) {
        if (input.clearWebhookReservationId)
          await remove(
            tx,
            "croco_billing_webhooks",
            this.namespace,
            input.clearWebhookReservationId,
          );
        await write(
          tx,
          "croco_billing_subscriptions",
          this.namespace,
          input.subscription.billingAccountId,
          input.subscription,
        );
      }
      await write(tx, "croco_billing_webhooks", this.namespace, input.eventId, {
        state: "RESERVED",
      });
      await write(tx, "croco_billing_transitions", this.namespace, input.eventId, transition);
      return transitionDates(transition);
    });
  }
  async markWebhookEventIntentPublished(eventId: string, intentEventId: string): Promise<void> {
    await atomic(this.db, this.namespace, async (tx) => {
      const transition = await read<BillingSubscriptionWebhookTransition>(
        tx,
        "croco_billing_transitions",
        this.namespace,
        eventId,
      );
      if (!transition) throw new WebhookAlreadyProcessedProblem(eventId);
      const time = await now(tx);
      await write(tx, "croco_billing_transitions", this.namespace, eventId, {
        ...transition,
        intents: transition.intents.map((intent) =>
          intent.event.eventId === intentEventId
            ? { ...intent, publishedAt: intent.publishedAt ?? time }
            : intent,
        ),
      });
    });
  }
  async claimWebhookDelivery(
    eventId: string,
    _eventType: string,
    leaseDurationMs: number,
  ): Promise<BillingWebhookDeliveryClaim> {
    return atomic(this.db, this.namespace, async (tx) => {
      const existing = await read<Webhook>(tx, "croco_billing_webhooks", this.namespace, eventId);
      if (existing?.state === "COMPLETED") return { status: "completed" };
      const time = await now(tx);
      if (existing?.leaseUntil && new Date(existing.leaseUntil).getTime() > time.getTime())
        return { status: "in_progress" };
      const token = randomUUID();
      await write(tx, "croco_billing_webhooks", this.namespace, eventId, {
        state: "RESERVED",
        token,
        leaseUntil: new Date(time.getTime() + leaseDurationMs),
      });
      return { status: "claimed", token };
    });
  }
  async completeWebhookDelivery(eventId: string, token: string): Promise<boolean> {
    return this.finishDelivery(eventId, token, true);
  }
  async releaseWebhookDelivery(eventId: string, token: string): Promise<boolean> {
    return this.finishDelivery(eventId, token, false);
  }
  private async finishDelivery(
    eventId: string,
    token: string,
    complete: boolean,
  ): Promise<boolean> {
    return atomic(this.db, this.namespace, async (tx) => {
      const existing = await read<Webhook>(tx, "croco_billing_webhooks", this.namespace, eventId);
      if (
        existing?.state !== "RESERVED" ||
        existing.token !== token ||
        !existing.leaseUntil ||
        new Date(existing.leaseUntil).getTime() <= (await now(tx)).getTime()
      )
        return false;
      if (complete)
        await write(tx, "croco_billing_webhooks", this.namespace, eventId, { state: "COMPLETED" });
      else await remove(tx, "croco_billing_webhooks", this.namespace, eventId);
      return true;
    });
  }
  async reserveWebhook(eventId: string, _eventType: string): Promise<void> {
    await atomic(this.db, this.namespace, async (tx) => {
      if (await read(tx, "croco_billing_webhooks", this.namespace, eventId))
        throw new WebhookAlreadyProcessedProblem(eventId);
      await write(tx, "croco_billing_webhooks", this.namespace, eventId, { state: "RESERVED" });
    });
  }
  async completeWebhook(eventId: string): Promise<void> {
    await atomic(this.db, this.namespace, async (tx) => {
      const existing = await read<Webhook>(tx, "croco_billing_webhooks", this.namespace, eventId);
      if (existing?.state !== "RESERVED") throw new WebhookAlreadyProcessedProblem(eventId);
      const transition = await read<BillingSubscriptionWebhookTransition>(
        tx,
        "croco_billing_transitions",
        this.namespace,
        eventId,
      );
      if (transition?.intents.some((intent) => intent.publishedAt === null))
        throw new WebhookEventIntentsPendingProblem(eventId);
      await write(tx, "croco_billing_webhooks", this.namespace, eventId, { state: "COMPLETED" });
      if (transition)
        await write(tx, "croco_billing_transitions", this.namespace, eventId, {
          ...transition,
          state: "completed",
        });
    });
  }
  async failWebhook(eventId: string): Promise<void> {
    await atomic(this.db, this.namespace, (tx) =>
      remove(tx, "croco_billing_webhooks", this.namespace, eventId),
    );
  }
}

function accountDates(value: BillingAccount): BillingAccount {
  return { ...value, createdAt: new Date(value.createdAt) };
}
function subscriptionDates(value: Subscription): Subscription {
  return {
    ...value,
    currentPeriodEnd: new Date(value.currentPeriodEnd),
    lastSyncedAt: new Date(value.lastSyncedAt),
    ...(value.providerModifiedAt ? { providerModifiedAt: new Date(value.providerModifiedAt) } : {}),
  };
}
function commandDates(value: BillingLifecycleCommand): BillingLifecycleCommand {
  return {
    ...value,
    subscription: subscriptionDates(value.subscription),
    createdAt: new Date(value.createdAt),
    updatedAt: new Date(value.updatedAt),
    ...(value.eventDeliveryLeaseUntil
      ? { eventDeliveryLeaseUntil: new Date(value.eventDeliveryLeaseUntil) }
      : {}),
    ...(value.lastFailure
      ? {
          lastFailure: { ...value.lastFailure, occurredAt: new Date(value.lastFailure.occurredAt) },
        }
      : {}),
  };
}
function transitionDates(
  value: BillingSubscriptionWebhookTransition,
): BillingSubscriptionWebhookTransition {
  return {
    ...value,
    subscription: subscriptionDates(value.subscription),
    previousSubscription: value.previousSubscription
      ? subscriptionDates(value.previousSubscription)
      : null,
    intents: value.intents.map((intent) => ({
      event: structuredClone(intent.event),
      publishedAt: intent.publishedAt ? new Date(intent.publishedAt) : null,
    })),
  };
}
function sameIntent(a: BillingLifecycleCommand, b: BillingLifecycleCommand): boolean {
  return (
    a.tenantId === b.tenantId &&
    a.kind === b.kind &&
    a.subscription.billingAccountId === b.subscription.billingAccountId &&
    a.subscription.externalSubscriptionId === b.subscription.externalSubscriptionId
  );
}
function allowed(
  from: BillingLifecycleCommand["state"],
  to: BillingLifecycleCommand["state"],
): boolean {
  switch (from) {
    case "pending_provider":
      return to === "pending_provider" || to === "pending_local";
    case "pending_local":
      return to === "pending_local" || to === "pending_event" || to === "completed";
    case "pending_event":
      return to === "pending_event" || to === "completed";
    case "completed":
      return false;
  }
}
