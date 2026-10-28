import { describe, expect, it, vi } from "vitest";
import {
  CreditLedgerService,
  InMemoryCreditLedgerStore,
  creditAmount,
  creditTransactionId,
} from "@croco/credits-core";
import { FirstPartyReferralCreditGrantAdapter } from "../credit-grant";
import type { ReferralBenefitIntent } from "../libs/types";

const subject = {
  appId: "shop",
  environment: "test",
  tenantId: "tenant",
  kind: "customer",
  id: "customer",
} as const;
const now = new Date("2026-10-01T00:00:00Z");
const intent: ReferralBenefitIntent = {
  id: "intent",
  attributionId: "attribution",
  side: "recipient",
  logicalKey: "benefit",
  idempotencyKey: "target",
  subject,
  benefit: { kind: "trial-credits", creditAmount: "7" },
  status: "granted",
  createdAt: now,
  updatedAt: now,
};
const input = { idempotencyKey: "target", intent, subject };

async function setup(priorGrants: number) {
  let sequence = 0;
  const ledger = new CreditLedgerService({
    store: new InMemoryCreditLedgerStore(),
    eventDelivery: "development",
    clock: () => now,
    idGenerator: () => `transaction-${++sequence}`,
  });
  const opened = await ledger.openAccount({
    tenantId: subject.tenantId,
    idempotencyKey: "open",
    reference: { type: "test", id: "account" },
  });
  const accountId = opened.account.id;
  const grant = (key: string) =>
    ledger.grantCredits({
      accountId,
      idempotencyKey: key,
      amount: creditAmount("7"),
      reference: { type: "test", id: key },
    });
  for (let i = 0; i < priorGrants; i++) await grant(`noise-${i}`);
  const adapter = new FirstPartyReferralCreditGrantAdapter({
    ledger,
    resolveAccount: () => accountId,
  });
  return { ledger, accountId, grant, adapter };
}

describe("FirstPartyReferralCreditGrantAdapter receipt lookup", () => {
  it.each([1, 100, 101])("finds the exact grant at position %i", async (position) => {
    const { adapter, grant } = await setup(position - 1);
    const target = await grant("target");
    expect(await adapter.check(input)).toEqual({ grantRef: target.transactions[0]?.id });
  });

  it("finds the exact grant at position 1001", async () => {
    const { adapter, ledger, accountId, grant } = await setup(0);
    const [receipt] = (await grant("target")).transactions;
    if (!receipt) throw new Error("missing grant fixture");
    // Exercise a long paged history without 1,000 unrelated ledger writes.
    // The cases above and the return tests retain real-ledger integration.
    const history = Array.from({ length: 1001 }, (_, index) => ({
      ...receipt,
      id: index === 1000 ? receipt.id : creditTransactionId(`noise-${index}`),
      idempotencyKey: index === 1000 ? "target" : `noise-${index}`,
      position: index + 1,
    }));
    let reads = 0;
    vi.spyOn(ledger, "getHistory").mockImplementation(async (requestedAccount, options = {}) => {
      if (++reads > history.length + 1) throw new Error("history scan did not advance");
      expect(requestedAccount).toBe(accountId);
      const position = options.atPosition ?? history.length;
      return {
        accountId,
        position,
        transactions: history
          .filter(
            (entry) => entry.position > (options.afterPosition ?? 0) && entry.position <= position,
          )
          .slice(0, options.limit ?? 100),
      };
    });
    expect(await adapter.check(input)).toEqual({ grantRef: receipt.id });
  });

  it("finishes a fixed snapshot while writes continue and finds a later receipt on the next check", async () => {
    const { adapter, ledger, grant } = await setup(201);
    const read = ledger.getHistory.bind(ledger);
    let reads = 0;
    let lateReceipt: string | undefined;
    const spy = vi.spyOn(ledger, "getHistory").mockImplementation(async (...args) => {
      if (++reads > 10) throw new Error("history scan did not terminate at its snapshot");
      const page = await read(...args);
      const added = await grant(reads === 1 ? "target" : `concurrent-${reads}`);
      if (reads === 1) lateReceipt = added.transactions[0]?.id;
      return page;
    });
    expect(await adapter.check(input)).toBeNull();
    expect(reads).toBeLessThanOrEqual(4);
    spy.mockRestore();
    expect(await adapter.check(input)).toEqual({ grantRef: lateReceipt });
  });

  it("finds an existing late receipt while writes continue", async () => {
    const { adapter, ledger, grant } = await setup(100);
    const target = await grant("target");
    const read = ledger.getHistory.bind(ledger);
    let reads = 0;
    vi.spyOn(ledger, "getHistory").mockImplementation(async (...args) => {
      if (++reads > 10) throw new Error("history scan did not terminate at its snapshot");
      const page = await read(...args);
      await grant(`concurrent-${reads}`);
      return page;
    });
    expect(await adapter.check(input)).toEqual({ grantRef: target.transactions[0]?.id });
  });

  it("returns null for an absent receipt or a matching non-grant transaction", async () => {
    const { adapter, ledger, accountId } = await setup(101);
    expect(await adapter.check(input)).toBeNull();
    await ledger.adjustCredits({
      accountId,
      idempotencyKey: "target",
      amount: creditAmount("3"),
      direction: "credit",
      reference: { type: "test", id: "adjustment" },
    });
    expect(await adapter.check(input)).toBeNull();
  });

  it("reverses the 101st grant once across return retries", async () => {
    const { adapter, ledger, accountId, grant } = await setup(100);
    await grant("target");
    const request = {
      returnIdempotencyKey: "return-target",
      intent,
      subject,
      attributionId: "attribution",
      policy: "explicit-return",
      reason: "duplicate reward",
    };
    const first = await adapter.reverse(request);
    expect(first).toEqual({ returnRef: expect.any(String) });
    expect(await adapter.reverse(request)).toEqual(first);
    expect(await adapter.checkReturn(request)).toEqual(first);
    const history = await ledger.getHistory(accountId, { afterPosition: 100 });
    expect(history.transactions.filter((entry) => entry.kind === "adjustment")).toHaveLength(1);
    expect(await ledger.getBalance(accountId)).toMatchObject({
      available: "700",
      netAdjusted: "-7",
    });
  });

  it("only confirms a matching compensating debit, including receipts beyond the first page", async () => {
    const { adapter, ledger, accountId, grant } = await setup(101);
    const request = {
      returnIdempotencyKey: "return-target",
      intent,
      subject,
      attributionId: "attribution",
    };
    expect(await adapter.checkReturn(request)).toBeNull();
    await ledger.adjustCredits({
      accountId,
      idempotencyKey: "unrelated-debit",
      amount: creditAmount("7"),
      direction: "debit",
      reference: { type: "other", id: "attribution" },
    });
    expect(
      await adapter.checkReturn({ ...request, returnIdempotencyKey: "unrelated-debit" }),
    ).toBeNull();
    await ledger.adjustCredits({
      accountId,
      idempotencyKey: "wrong-direction",
      amount: creditAmount("7"),
      direction: "credit",
      reference: { type: "referral-benefit-return", id: "attribution" },
    });
    expect(
      await adapter.checkReturn({ ...request, returnIdempotencyKey: "wrong-direction" }),
    ).toBeNull();
    const receipt = await ledger.adjustCredits({
      accountId,
      idempotencyKey: "return-target",
      amount: creditAmount("7"),
      direction: "debit",
      reference: { type: "referral-benefit-return", id: "attribution" },
    });
    expect(await adapter.checkReturn(request)).toEqual({ returnRef: receipt.transactions[0]?.id });
    expect(
      await adapter.checkReturn({ ...request, attributionId: "other-attribution" }),
    ).toBeNull();
    expect(
      await adapter.checkReturn({ ...request, subject: { ...subject, tenantId: "other-tenant" } }),
    ).toBeNull();
    expect(
      await adapter.checkReturn({
        ...request,
        intent: { ...intent, benefit: { kind: "trial-credits", creditAmount: "3" } },
      }),
    ).toBeNull();
    expect(await adapter.checkReturn({ ...request, returnIdempotencyKey: "noise-1" })).toBeNull();
    // Move the receipt behind later history as well; lookup pins and traverses its snapshot.
    for (let i = 0; i < 101; i++) await grant(`later-${i}`);
    expect(await adapter.checkReturn(request)).toEqual({ returnRef: receipt.transactions[0]?.id });
  });

  it("reports a missing grant without debiting the account", async () => {
    const { adapter, ledger, accountId } = await setup(101);
    expect(
      await adapter.reverse({
        returnIdempotencyKey: "return-target",
        intent,
        subject,
        attributionId: "attribution",
        policy: "explicit-return",
        reason: "missing receipt",
      }),
    ).toEqual({ error: expect.stringContaining("no confirmed grant") });
    expect(await ledger.getBalance(accountId)).toMatchObject({
      available: "707",
      netAdjusted: "0",
    });
  });
});
