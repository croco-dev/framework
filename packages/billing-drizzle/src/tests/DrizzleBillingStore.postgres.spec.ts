import { readFile } from "node:fs/promises";
import {
  BillingService,
  CancellationService,
  BillingCancellationAction,
  planVersionRef,
  BillingLifecycleCommandConflictProblem,
  BillingLifecycleCommandInProgressProblem,
  CancellationConflictProblem,
  WebhookAlreadyProcessedProblem,
  WebhookEventIntentsPendingProblem,
} from "@croco/billing-core";
import { InMemoryIdempotencyStore } from "@croco/idempotency-core";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { DrizzleBillingStore, DrizzleCancellationStore } from "../index";
import type {
  BillingGateway,
  BillingLifecycleCommand,
  Subscription,
  CancellationSession,
  ChoicePolicy,
  CancellationAuthority,
} from "@croco/billing-core";

const connectionString = process.env.BILLING_TEST_DATABASE_URL;
const scope = { appId: "billing-test", environment: "test" };
const identity = { ...scope, tenantId: "tenant", subject: "owner", subscriptionRef: "sub" };
const instant = new Date("2026-10-01T00:00:00Z");
const subscription: Subscription = {
  id: "sub",
  billingAccountId: "account",
  externalSubscriptionId: "external",
  planId: "plan",
  planVersionRef: planVersionRef("plan:v1"),
  status: "active",
  currentPeriodEnd: new Date("2026-11-01T00:00:00Z"),
  cancelAtPeriodEnd: false,
  lastSyncedAt: instant,
};
const command = (key = "operation"): BillingLifecycleCommand => ({
  idempotencyKey: key,
  tenantId: "tenant",
  kind: "cancel_at_period_end",
  subscription,
  revision: 0,
  state: "pending_provider",
  createdAt: instant,
  updatedAt: instant,
});
const session = (): CancellationSession => ({
  ...identity,
  id: "session",
  revision: 0,
  subscriptionRevision: "v1",
  quoteRef: "quote",
  policyVersion: 0,
  snapshot: {
    ...identity,
    revision: "v1",
    billingPeriod: "renewal",
    subscriptionStartedAt: "2026-01-01T00:00:00Z",
    status: "active",
    quote: {
      ref: "quote",
      expiresAt: "2027-01-01T00:00:00Z",
      refund: "none",
      amount: "0",
      currency: "USD",
    },
  },
  choices: [],
  keepAvailable: true,
  state: "open",
  createdAt: instant.toISOString(),
  evidence: [{ kind: "intent", at: instant.toISOString() }],
});

describe.skipIf(!connectionString)("PostgreSQL billing persistence", () => {
  let pool: Pool;
  let secondPool: Pool;
  let first: DrizzleBillingStore;
  let second: DrizzleBillingStore;
  beforeAll(async () => {
    pool = new Pool({ connectionString, max: 1 });
    secondPool = new Pool({ connectionString, max: 1 });
    await pool.query(
      await readFile(new URL("../../migrations/0001_billing.up.sql", import.meta.url), "utf8"),
    );
  });
  afterAll(async () => {
    if (pool) {
      await pool.query(
        await readFile(new URL("../../migrations/0001_billing.down.sql", import.meta.url), "utf8"),
      );
      await Promise.all([pool.end(), secondPool.end()]);
    }
  });
  beforeEach(async () => {
    await pool.query(
      "TRUNCATE croco_billing_accounts, croco_billing_subscriptions, croco_billing_commands, croco_billing_orders, croco_billing_webhooks, croco_billing_transitions, croco_cancellation_sessions, croco_cancellation_policies, croco_cancellation_policy_audits",
    );
    first = new DrizzleBillingStore(drizzle(pool), scope);
    second = new DrizzleBillingStore(drizzle(secondPool), scope);
    await first.saveAccount({
      id: "account",
      tenantId: "tenant",
      externalCustomerId: "customer",
      email: "owner@example.test",
      createdAt: instant,
    });
    await first.saveSubscription(subscription);
  });

  it("deduplicates concurrent intent creation, excludes pending commands, and rejects stale/completed writes", async () => {
    const results = await Promise.all([
      first.createLifecycleCommand(command()),
      second.createLifecycleCommand(command()),
    ]);
    expect(results[0]).toEqual(results[1]);
    await expect(second.createLifecycleCommand(command("other"))).rejects.toBeInstanceOf(
      BillingLifecycleCommandInProgressProblem,
    );
    await expect(
      second.createLifecycleCommand({ ...command(), kind: "resume" }),
    ).rejects.toBeInstanceOf(BillingLifecycleCommandConflictProblem);
    const updates = await Promise.allSettled([
      first.saveLifecycleCommand({ ...results[0], state: "pending_local" }),
      second.saveLifecycleCommand({ ...results[1], state: "pending_local" }),
    ]);
    expect(updates.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const current = await second.findLifecycleCommand("operation");
    expect(current?.revision).toBe(1);
    const completed = await first.saveLifecycleCommand({
      ...current!,
      state: "completed",
      localResult: "applied",
    });
    await expect(second.saveLifecycleCommand(completed)).rejects.toBeInstanceOf(
      BillingLifecycleCommandConflictProblem,
    );
    expect(await second.findPendingLifecycleCommandByTenantId("tenant")).toBeNull();
    expect(await second.createLifecycleCommand(command("next"))).toMatchObject({ revision: 0 });
  });

  it("restarts BillingService after provider acceptance loses its response and reuses one provider operation", async () => {
    const effects = new Set<string>();
    let loseResponse = true;
    const gateway: BillingGateway = {
      ensureCustomer: vi.fn(),
      createCheckout: vi.fn(),
      reconcileCheckout: vi.fn(),
      resumeSubscription: vi.fn(),
      getCustomerPortalUrl: vi.fn(),
      cancelSubscription: vi.fn(async (_id, _immediate, options) => {
        effects.add(options.idempotencyKey);
        if (loseResponse) {
          loseResponse = false;
          throw new BillingLifecycleCommandConflictProblem("lost-response");
        }
      }),
    };
    const service = new BillingService({
      store: first,
      gateway,
      checkoutIdempotencyStore: new InMemoryIdempotencyStore(),
    });
    await expect(
      service.cancelSubscription({ tenantId: "tenant", idempotencyKey: "cancel-one" }),
    ).resolves.toMatchObject({ state: "pending_provider" });
    expect(effects.size).toBe(1);
    expect(await second.findLifecycleCommand("cancel-one")).toMatchObject({
      state: "pending_provider",
      lastFailure: { stage: "provider" },
    });
    const restarted = new BillingService({
      store: new DrizzleBillingStore(drizzle(secondPool), scope),
      gateway,
      checkoutIdempotencyStore: new InMemoryIdempotencyStore(),
    });
    const result = await restarted.cancelSubscription({
      tenantId: "tenant",
      idempotencyKey: "cancel-one",
    });
    expect(result.state).toBe("completed");
    expect(effects.size).toBe(1);
    expect(gateway.cancelSubscription).toHaveBeenCalledTimes(2);
    expect(await first.findSubscription("account")).toMatchObject({ cancelAtPeriodEnd: true });
  });

  it("restarts the full cancellation flow after an ambiguous provider response", async () => {
    const effects = new Set<string>();
    let loseResponse = true;
    const gateway: BillingGateway = {
      ensureCustomer: vi.fn(),
      createCheckout: vi.fn(),
      reconcileCheckout: vi.fn(),
      resumeSubscription: vi.fn(),
      getCustomerPortalUrl: vi.fn(),
      cancelSubscription: vi.fn(async (_id, _immediate, options) => {
        effects.add(options.idempotencyKey);
        if (loseResponse) {
          loseResponse = false;
          throw new BillingLifecycleCommandConflictProblem("lost-response");
        }
      }),
    };
    const authority: CancellationAuthority = {
      authorize: async () => {},
      authorizePolicy: async () => {},
      snapshot: async () => session().snapshot,
      admit: async (_identity, _snapshot, operation) => operation(),
    };
    const create = (store: DrizzleBillingStore, sessionStore: DrizzleCancellationStore) => {
      const billing = new BillingService({
        store,
        gateway,
        checkoutIdempotencyStore: new InMemoryIdempotencyStore(),
      });
      return new CancellationService({
        store: sessionStore,
        authority,
        choices: [],
        actions: [new BillingCancellationAction("cancel", identity, billing, store, authority)],
      });
    };
    const started = create(first, new DrizzleCancellationStore(drizzle(pool)));
    await started.createSession(identity, "flow");
    await started.markDisplayed(identity, "flow");
    const uncertain = await started.decide(identity, "flow", {
      decisionId: "confirm",
      kind: "continue_cancel",
    });
    expect(uncertain.commandReceipt).toMatchObject({
      providerOutcome: "indeterminate",
      effect: "none",
      refundOutcome: "not_requested",
    });
    const restarted = create(second, new DrizzleCancellationStore(drizzle(secondPool)));
    const resolved = await restarted.reconcile(identity, "flow");
    expect(resolved.commandReceipt).toMatchObject({
      providerOutcome: "confirmed",
      effect: "cancellation_scheduled",
      refundOutcome: "not_requested",
    });
    expect(effects.size).toBe(1);
    expect(resolved.evidence.map((item) => item.kind)).toEqual([
      "intent",
      "displayed",
      "decision",
      "command",
      "provider",
      "provider",
    ]);
    expect(
      (await restarted.decide(identity, "flow", { decisionId: "confirm", kind: "continue_cancel" }))
        .commandReceipt,
    ).toEqual(resolved.commandReceipt);
    expect(effects.size).toBe(1);
  });

  it("rebases local changes, classifies stale reads, and never overwrites a replacement subscription", async () => {
    const saved = await first.createLifecycleCommand(command());
    const pending = await first.saveLifecycleCommand({ ...saved, state: "pending_local" });
    const newer = {
      ...subscription,
      planId: "new-plan",
      providerModifiedAt: new Date("2026-10-03T00:00:00Z"),
    };
    await second.saveSubscription(newer);
    expect(await first.resolveLifecycleSubscription(pending)).toEqual({
      kind: "projection_base",
      subscription: newer,
    });
    await first.reconcileLifecycleSubscription(pending, {
      ...subscription,
      cancelAtPeriodEnd: true,
    });
    expect(await second.findSubscription("account")).toMatchObject({
      planId: "new-plan",
      cancelAtPeriodEnd: true,
    });
    await second.saveSubscription({ ...newer, externalSubscriptionId: "replacement" });
    expect(await first.reconcileLifecycleSubscription(pending, null)).toBe("superseded");
    expect(await first.resolveLifecycleSubscription(pending)).toMatchObject({
      kind: "current",
      subscription: { externalSubscriptionId: "replacement" },
    });
    expect(await first.findAccountByTenantId("tenant")).not.toBeNull();
  });

  it("serializes database-clock delivery leases across connections", async () => {
    const claims = await Promise.all([
      first.claimWebhookDelivery("event", "invoice", 60_000),
      second.claimWebhookDelivery("event", "invoice", 60_000),
    ]);
    expect(claims.filter((claim) => claim.status === "claimed")).toHaveLength(1);
    const owned = claims.find((claim) => claim.status === "claimed");
    expect(await second.completeWebhookDelivery("event", "wrong")).toBe(false);
    expect(await second.completeWebhookDelivery("event", owned!.token)).toBe(true);
    expect(await first.claimWebhookDelivery("event", "invoice", 60_000)).toEqual({
      status: "completed",
    });
    const expired = await first.claimWebhookDelivery("expired", "invoice", -1);
    if (expired.status !== "claimed") throw new BillingLifecycleCommandConflictProblem("test");
    expect(await second.releaseWebhookDelivery("expired", expired.token)).toBe(false);
    const reclaimed = await second.claimWebhookDelivery("expired", "invoice", 60_000);
    expect(reclaimed.status).toBe("claimed");
    expect(reclaimed).not.toEqual(expired);
    const created = await first.createLifecycleCommand(command());
    const local = await first.saveLifecycleCommand({ ...created, state: "pending_local" });
    const event = await first.saveLifecycleCommand({
      ...local,
      state: "pending_event",
      localResult: "applied",
    });
    await expect(
      first.saveLifecycleCommand({ ...event, localResult: undefined }),
    ).rejects.toBeInstanceOf(BillingLifecycleCommandConflictProblem);
    const deliveries = await Promise.all([
      first.claimLifecycleEventDelivery(event, 60_000),
      second.claimLifecycleEventDelivery(event, 60_000),
    ]);
    expect(deliveries.filter(Boolean)).toHaveLength(1);
    const claimed = deliveries.find(Boolean)!;
    expect(claimed.eventDeliveryLeaseUntil).toBeInstanceOf(Date);
    expect(await first.claimLifecycleEventDelivery(claimed, 60_000)).toBeNull();
  });

  it("persists webhook intents exactly once, rolls back failed derivation, and suppresses older observations", async () => {
    const derive = vi.fn(() => [
      {
        eventId: "intent",
        eventType: "billing.changed",
        occurredAt: instant.toISOString(),
        payload: {},
      },
    ]);
    const input = {
      eventId: "webhook",
      eventType: "subscription",
      subscription: { ...subscription, cancelAtPeriodEnd: true },
      createEventIntents: derive,
    };
    const transitions = await Promise.all([
      first.commitSubscriptionWebhook(input),
      second.commitSubscriptionWebhook(input),
    ]);
    expect(transitions[0]).toEqual(transitions[1]);
    expect(derive).toHaveBeenCalledTimes(1);
    await expect(first.completeWebhook("webhook")).rejects.toBeInstanceOf(
      WebhookEventIntentsPendingProblem,
    );
    await second.markWebhookEventIntentPublished("webhook", "intent");
    await first.completeWebhook("webhook");
    expect((await second.commitSubscriptionWebhook(input)).state).toBe("completed");
    await expect(second.reserveWebhook("webhook", "subscription")).rejects.toBeInstanceOf(
      WebhookAlreadyProcessedProblem,
    );
    await expect(
      first.commitSubscriptionWebhook({
        ...input,
        eventId: "rollback",
        createEventIntents: () => {
          throw new BillingLifecycleCommandConflictProblem("derive");
        },
      }),
    ).rejects.toThrow();
    await second.reserveWebhook("rollback", "subscription");
    await first.saveSubscription({
      ...subscription,
      providerModifiedAt: new Date("2026-10-05T00:00:00Z"),
    });
    const older = await second.commitSubscriptionWebhook({
      ...input,
      eventId: "old",
      clearWebhookReservationId: "rollback",
      subscription: { ...subscription, providerModifiedAt: instant },
    });
    expect(older.intents).toEqual([]);
    expect(derive).toHaveBeenCalledTimes(1);
    await expect(first.reserveWebhook("rollback", "subscription")).rejects.toBeInstanceOf(
      WebhookAlreadyProcessedProblem,
    );
  });

  it("keeps apps and environments isolated and upserts order identities", async () => {
    const other = new DrizzleBillingStore(drizzle(secondPool), { ...scope, environment: "other" });
    expect(await other.findAccountByTenantId("tenant")).toBeNull();
    await other.saveAccount({
      id: "account",
      tenantId: "tenant",
      externalCustomerId: "customer",
      email: "other@example.test",
      createdAt: instant,
    });
    expect((await first.findAccountByTenantId("tenant"))?.email).toBe("owner@example.test");
    const order = {
      id: "order",
      billingAccountId: "account",
      externalOrderId: "provider-order",
      amount: 100,
      currency: "USD",
      reason: "one_time" as const,
      paidAt: instant,
    };
    await Promise.all([first.saveOrder(order), second.saveOrder(order)]);
    expect(await first.findOrdersByAccount("account")).toEqual([order]);
  });

  it("atomically CAS-reserves a session decision, persists evidence, and isolates every scope dimension", async () => {
    const a = new DrizzleCancellationStore(drizzle(pool));
    const b = new DrizzleCancellationStore(drizzle(secondPool));
    const original = session();
    await a.createSession(original);
    const decided: CancellationSession = {
      ...original,
      revision: 1,
      state: "decided",
      decision: { decisionId: "decision", kind: "continue_cancel" },
      commandReceipt: {
        commandId: "command",
        providerOutcome: "pending",
        effect: "none",
        refundOutcome: "not_requested",
      },
      evidence: [
        ...original.evidence,
        { kind: "decision", at: instant.toISOString(), decisionId: "decision" },
      ],
    };
    expect(
      (await Promise.all([a.saveSession(decided, 0), b.saveSession(decided, 0)])).sort(),
    ).toEqual([false, true]);
    expect(
      await new DrizzleCancellationStore(drizzle(secondPool)).getSession(identity, original.id),
    ).toEqual(decided);
    await expect(
      a.saveSession({ ...decided, revision: 2, evidence: [] }, 1),
    ).rejects.toBeInstanceOf(CancellationConflictProblem);
    for (const different of [
      { ...identity, appId: "other" },
      { ...identity, environment: "other" },
      { ...identity, tenantId: "other" },
    ]) {
      expect(await b.getSession(different, original.id)).toBeUndefined();
      expect(await b.listSessions(different)).toEqual([]);
    }
  });

  it("CAS-publishes policies with durable replay-safe audit in the same transaction", async () => {
    const a = new DrizzleCancellationStore(drizzle(pool));
    const b = new DrizzleCancellationStore(drizzle(secondPool));
    const policy: ChoicePolicy = { ...identity, version: 1, entries: [] };
    const audit = {
      actor: "operator",
      reason: "reviewed",
      idempotencyKey: "publish",
      expectedRevision: 0,
      at: instant.toISOString(),
    };
    const results = await Promise.all([
      a.savePolicy(policy, audit),
      b.savePolicy(policy, { ...audit, at: "2026-10-02T00:00:00Z" }),
    ]);
    expect(results).toEqual([policy, policy]);
    await expect(
      b.savePolicy(
        {
          ...policy,
          entries: [
            {
              choiceId: "resume",
              label: "Resume",
              order: 0,
              enabled: true,
              billingPeriods: ["renewal"],
              refundKinds: ["none"],
            },
          ],
        },
        audit,
      ),
    ).rejects.toBeInstanceOf(CancellationConflictProblem);
    await expect(
      b.savePolicy(policy, { ...audit, idempotencyKey: "other" }),
    ).rejects.toBeInstanceOf(CancellationConflictProblem);
    expect(await b.getPolicy(identity)).toEqual(policy);
    const rows = await pool.query("SELECT data FROM croco_cancellation_policy_audits");
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0].data.audit.actor).toBe("operator");
  });
});
