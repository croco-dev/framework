import { creditAccountId, creditAmount, creditTransactionId } from "@croco/credits-core";
import { describe, expect, it } from "vitest";
import {
  billingOrderOutcome,
  creditGrantOutcome,
  engagementContactCostOutcome,
  settledRefundOutcome,
} from "../libs/OutcomeSourceMapping";
import type { BillingAccount, Order } from "@croco/billing-core";
import type { CreditAccount, CreditTransaction } from "@croco/credits-core";
import type { EngagementDispatch } from "@croco/engagement-core";

const at = "2026-09-22T00:00:00.000Z";
const binding = {
  scope: { app: "shop", environment: "test", tenant: "one" },
  source: "billing",
  subject: "assigned-unit",
  observedAt: at,
};
const account: BillingAccount = {
  id: "account",
  tenantId: "one",
  externalCustomerId: "customer",
  email: "masked@example.test",
  createdAt: new Date(at),
};
const order: Order = {
  id: "order",
  billingAccountId: "account",
  externalOrderId: "payment",
  amount: 800,
  currency: "KRW",
  reason: "one_time",
  paidAt: new Date(at),
};
const creditAccount: CreditAccount = {
  id: creditAccountId("account"),
  tenantId: "one",
  openedAt: new Date(at),
  position: 1,
};
const grant: CreditTransaction = {
  id: creditTransactionId("grant"),
  accountId: creditAccount.id,
  position: 1,
  kind: "grant",
  amount: creditAmount("50"),
  occurredAt: new Date(at),
  idempotencyKey: "key",
  reference: { type: "offer", id: "one" },
  allocations: [],
};
const dispatch: EngagementDispatch = {
  id: "dispatch",
  tenantId: "one",
  messageId: "message",
  recipientId: "assigned-unit",
  channel: "email",
  semanticKey: "key",
  topic: "news",
  targets: [],
  outcome: { kind: "queued", executionIds: ["execution"] },
  createdAt: new Date(at),
  updatedAt: new Date(at),
};

describe("Outcome source mappings", () => {
  it("maps the actual paid amount without subtracting a discount or exposing account data", () => {
    const event = billingOrderOutcome(order, account, binding);
    expect(event).toMatchObject({ eventId: "payment", amountMinor: "800", valuationKind: "cash" });
    expect(JSON.stringify(event)).not.toContain(account.email);
    expect(() =>
      billingOrderOutcome({ ...order, amount: Number.MAX_SAFE_INTEGER + 1 }, account, binding),
    ).toThrow();
    expect(() => billingOrderOutcome(order, { ...account, tenantId: "other" }, binding)).toThrow();
    expect(() =>
      billingOrderOutcome({ ...order, paidAt: new Date(NaN) }, account, binding),
    ).toThrow();
  });

  it("requires a separate settled refund reference rather than inventing a billing refund store", () => {
    const payment = billingOrderOutcome(order, account, binding);
    expect(
      settledRefundOutcome({
        ...payment,
        eventId: "refund",
        kind: "refund",
        amountMinor: "10",
        relatedPaymentId: "payment",
      }),
    ).toMatchObject({ kind: "refund", relatedPaymentId: "payment" });
    expect(() => settledRefundOutcome({ ...payment, kind: "refund" })).toThrow();
  });

  it("keeps credit units and explicitly valued noncash face value separate", () => {
    const result = creditGrantOutcome(grant, creditAccount, binding, {
      amountMinor: "2000",
      currency: "KRW",
      valuationRef: "offer-face-v1",
    });
    expect(result).toMatchObject({
      creditUnits: "50",
      valuationRef: "offer-face-v1",
      event: { amountMinor: "2000", kind: "noncash_grant", valuationKind: "face_value" },
    });
    expect(() =>
      creditGrantOutcome({ ...grant, kind: "refund" }, creditAccount, binding, {
        amountMinor: "2000",
        currency: "KRW",
        valuationRef: "offer-face-v1",
      }),
    ).toThrow();
    expect(() =>
      creditGrantOutcome(grant, creditAccount, binding, {
        amountMinor: "2000",
        currency: "KRW",
        valuationRef: "",
      }),
    ).toThrow();
  });

  it("does not infer zero or a settled cost from a queued dispatch", () => {
    expect(engagementContactCostOutcome(dispatch, binding)).toEqual({
      status: "missing",
      source: "billing",
      subject: "assigned-unit",
    });
    const receipt = {
      id: "cost",
      dispatchId: "dispatch",
      amountMinor: "17",
      currency: "KRW",
      incurredAt: at,
      observedAt: at,
    };
    expect(engagementContactCostOutcome(dispatch, binding, receipt)).toMatchObject({
      status: "settled",
      event: { eventId: "cost", kind: "direct_contact_cost", amountMinor: "17" },
    });
    expect(() =>
      engagementContactCostOutcome(dispatch, binding, { ...receipt, dispatchId: "other" }),
    ).toThrow();
    expect(() =>
      engagementContactCostOutcome({ ...dispatch, tenantId: "other" }, binding, receipt),
    ).toThrow();
  });
});
