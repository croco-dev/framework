import { InMemoryIdempotencyStore } from "@croco/idempotency-core";
import { describe, expect, it, vi } from "vitest";
import { BillingCancellationAction } from "../libs/BillingCancellationAction";
import { BillingService } from "../libs/BillingService";
import { InMemoryBillingStore } from "../libs/InMemoryBillingStore";
import {
  CancellationAuthorizationProblem,
  CancellationUnavailableProblem,
} from "../libs/problems/CancellationProblems";
import type { BillingGateway } from "../libs/BillingGateway";
import type {
  CancellationAuthority,
  CancellationSession,
  CancellationSnapshot,
} from "../libs/Cancellation";
import type { Subscription } from "../types";

async function fixture() {
  const scope = { appId: "app", environment: "test", tenantId: "tenant" };
  const identity = { ...scope, subject: "verified", subscriptionRef: "sub" };
  let snapshot: CancellationSnapshot = {
    ...identity,
    revision: "1",
    subscriptionStartedAt: "2026-01-01T00:00:00Z",
    billingPeriod: "renewal",
    status: "active",
    quote: {
      ref: "quote",
      amount: "9.50",
      currency: "USD",
      refund: "partial",
      expiresAt: "2030-01-01T00:00:00Z",
    },
  };
  const store = new InMemoryBillingStore();
  await store.saveAccount({
    id: "account",
    tenantId: scope.tenantId,
    externalCustomerId: "customer",
    email: "fixture@example.invalid",
    createdAt: new Date(),
  });
  const subscription: Subscription = {
    id: "sub",
    billingAccountId: "account",
    externalSubscriptionId: "external",
    planId: "plan",
    planVersionRef: "plan@v1" as Subscription["planVersionRef"],
    status: "active",
    currentPeriodEnd: new Date("2030-01-01T00:00:00Z"),
    cancelAtPeriodEnd: false,
    lastSyncedAt: new Date(),
  };
  await store.saveSubscription(subscription);
  const gateway: BillingGateway = {
    ensureCustomer: vi.fn(),
    createCheckout: vi.fn(),
    reconcileCheckout: vi.fn(),
    cancelSubscription: vi.fn(),
    resumeSubscription: vi.fn(),
    getCustomerPortalUrl: vi.fn(),
  };
  const billing = new BillingService({
    store,
    gateway,
    checkoutIdempotencyStore: new InMemoryIdempotencyStore(),
  });
  const readSnapshot = vi.fn(async () => snapshot);
  const authority: CancellationAuthority = {
    authorize: async () => {},
    authorizePolicy: async () => {},
    snapshot: readSnapshot,
    admit: async (_identity, _snapshot, operation) => operation(),
  };
  const action = new BillingCancellationAction("cancel", scope, billing, store, authority);
  const session: CancellationSession = {
    ...identity,
    id: "session",
    revision: 1,
    subscriptionRevision: "1",
    quoteRef: "quote",
    policyVersion: 0,
    snapshot,
    choices: [],
    keepAvailable: true,
    state: "decided",
    createdAt: new Date().toISOString(),
    evidence: [],
    decision: { kind: "continue_cancel", decisionId: "decision" },
    commandReceipt: {
      commandId: "command",
      providerOutcome: "pending",
      effect: "none",
      refundOutcome: "not_requested",
    },
  };
  await store.createLifecycleCommand({
    idempotencyKey: "command",
    tenantId: scope.tenantId,
    kind: "cancel_at_period_end",
    subscription,
    state: "pending_provider",
    revision: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return {
    store,
    gateway,
    billing,
    authority,
    scope,
    action,
    session,
    readSnapshot,
    setSnapshot(value: Partial<CancellationSnapshot>) {
      snapshot = { ...snapshot, ...value };
    },
  };
}
describe("BillingCancellationAction", () => {
  it("observes scheduled cancellation then actual termination without repeating a provider mutation or claiming a refund", async () => {
    const f = await fixture();
    expect((await f.store.findLifecycleCommand("command"))?.state).toBe("pending_provider");
    expect(await f.action.lookup({ session: f.session, commandId: "command" })).toMatchObject({
      providerOutcome: "confirmed",
      effect: "cancellation_scheduled",
      refundOutcome: "not_requested",
    });
    f.setSnapshot({
      status: "ended",
      revision: "2",
      quote: { ...f.session.snapshot.quote, expiresAt: "2020-01-01T00:00:00Z" },
    });
    expect(await f.action.lookup({ session: f.session, commandId: "command" })).toMatchObject({
      providerOutcome: "confirmed",
      effect: "ended",
      refundOutcome: "not_requested",
    });
    expect(f.gateway.cancelSubscription).toHaveBeenCalledTimes(1);
  });
  it("resumes through the existing billing lifecycle and reconciles without repeating the provider operation", async () => {
    const f = await fixture();
    await f.action.lookup({ session: f.session, commandId: "command" });
    expect((await f.store.findSubscription("account"))?.cancelAtPeriodEnd).toBe(true);
    const action = new BillingCancellationAction(
      "resume",
      f.scope,
      f.billing,
      f.store,
      f.authority,
    );
    const session = {
      ...f.session,
      snapshot: { ...f.session.snapshot, status: "cancellation_scheduled" as const },
      decision: { kind: "keep_subscription" as const, decisionId: "keep" },
    };
    expect(action.available(session.snapshot)).toBe(true);
    expect(await action.execute({ session, commandId: "resume-command" })).toMatchObject({
      providerOutcome: "confirmed",
      effect: "resumed",
      refundOutcome: "not_requested",
    });
    expect((await f.store.findSubscription("account"))?.cancelAtPeriodEnd).toBe(false);
    expect(await action.lookup({ session, commandId: "resume-command" })).toMatchObject({
      effect: "resumed",
    });
    expect(f.gateway.resumeSubscription).toHaveBeenCalledExactlyOnceWith("external", {
      idempotencyKey: "resume-command",
    });
  });
  it("preserves a completed command when observing the source fails", async () => {
    const f = await fixture();
    await f.action.lookup({ session: f.session, commandId: "command" });
    f.readSnapshot.mockRejectedValueOnce(new CancellationUnavailableProblem());
    await expect(
      f.action.lookup({ session: f.session, commandId: "command" }),
    ).rejects.toBeInstanceOf(CancellationUnavailableProblem);
    expect((await f.store.findLifecycleCommand("command"))?.state).toBe("completed");
    await f.action.lookup({ session: f.session, commandId: "command" });
    expect(f.gateway.cancelSubscription).toHaveBeenCalledTimes(1);
  });
  it("rejects termination evidence belonging to another subject", async () => {
    const f = await fixture();
    await f.action.lookup({ session: f.session, commandId: "command" });
    f.setSnapshot({ subject: "other", status: "ended" });
    await expect(
      f.action.lookup({ session: f.session, commandId: "command" }),
    ).rejects.toBeInstanceOf(CancellationAuthorizationProblem);
    expect(f.gateway.cancelSubscription).toHaveBeenCalledTimes(1);
  });
});
