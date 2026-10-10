import { describe, expect, it, vi } from "vitest";
import type { CancellationSession } from "@croco/billing-core";
import {
  RetentionOfferOperations,
  summarizeRetentionOffers,
} from "../libs/RetentionOfferOperations";
const scope = { appId: "app", environment: "test", tenantId: "tenant" };
const session: CancellationSession = {
  evidence: [],
  keepAvailable: true,
  ...scope,
  id: "session",
  subject: "subject",
  subscriptionRef: "sub",
  revision: 1,
  subscriptionRevision: "r1",
  quoteRef: "q",
  policyVersion: 2,
  state: "decided",
  createdAt: "2026-01-01T00:00:00Z",
  choices: [],
  snapshot: {
    subscriptionStartedAt: "2025-12-01T00:00:00Z",
    ...scope,
    subject: "subject",
    subscriptionRef: "sub",
    revision: "r1",
    status: "active",
    billingPeriod: "initial",
    quote: {
      ref: "q",
      expiresAt: "2099-01-01T00:00:00Z",
      refund: "full",
      amount: "1000",
      currency: "USD",
    },
  },
  decision: { decisionId: "d", kind: "continue_cancel" },
  commandReceipt: {
    commandId: "c",
    providerOutcome: "confirmed",
    effect: "cancellation_scheduled",
    refundOutcome: "pending",
  },
};
describe("RetentionOfferOperations", () => {
  it("shows independent cancellation history before an optional offer policy is created", async () => {
    const operations = new RetentionOfferOperations({
      service: { listSessions: async () => [session], updatePolicy: vi.fn() },
      store: { getPolicy: async () => undefined },
      registration: [],
      actor: async () => "authenticated-admin",
      now: () => new Date("2026-01-01T00:00:00Z"),
    });
    const view = await operations.load(scope);
    expect(view.policy).toEqual({ ...scope, version: 0, entries: [] });
    expect(view.reports[0]).toMatchObject({ cancelled: 1, scheduled: 1, ended: 0 });
  });
  it("groups exact authoritative quotes and separates choice, scheduling, end and refunds", () => {
    const reports = summarizeRetentionOffers([
      session,
      {
        ...session,
        id: "other",
        snapshot: {
          ...session.snapshot,
          billingPeriod: "renewal",
          quote: { ...session.snapshot.quote, refund: "partial", amount: "500" },
        },
      },
    ]);
    expect(reports).toHaveLength(2);
    expect(reports[0]).toMatchObject({
      billingPeriod: "initial",
      subscriptionAgeDays: 31,
      amount: "1000",
      cancelled: 1,
      scheduled: 1,
      ended: 0,
      refundsConfirmed: 0,
    });
    expect(reports[1]).toMatchObject({
      billingPeriod: "renewal",
      amount: "500",
      refund: "partial",
    });
  });
  it("resolves audit actor on server and delegates revision and idempotency enforcement", async () => {
    const policy = { ...scope, version: 1, entries: [] };
    const updatePolicy = vi.fn(async () => policy);
    const operations = new RetentionOfferOperations({
      service: { listSessions: async () => [], updatePolicy },
      store: { getPolicy: async () => policy },
      registration: [],
      actor: async () => "authenticated-admin",
      now: () => new Date("2026-01-01T00:00:00Z"),
    });
    await operations.save(scope, {
      entries: [],
      reason: "Approved terms",
      expectedRevision: 0,
      idempotencyKey: "edit-1",
    });
    expect(updatePolicy).toHaveBeenCalledWith(scope, [], {
      actor: "authenticated-admin",
      reason: "Approved terms",
      expectedRevision: 0,
      idempotencyKey: "edit-1",
      at: "2026-01-01T00:00:00.000Z",
    });
  });
  it("does not read policy after authorization failure", async () => {
    const getPolicy = vi.fn();
    const operations = new RetentionOfferOperations({
      service: {
        listSessions: async () => {
          throw new Error("denied");
        },
        updatePolicy: vi.fn(),
      },
      store: { getPolicy },
      registration: [],
      actor: async () => "actor",
      now: () => new Date(),
    });
    await expect(operations.load(scope)).rejects.toThrow("denied");
    expect(getPolicy).not.toHaveBeenCalled();
  });
});
