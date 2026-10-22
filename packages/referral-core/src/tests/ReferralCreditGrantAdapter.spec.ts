import { describe, expect, it, vi } from "vitest";
import { CreditLedgerService, InMemoryCreditLedgerStore, creditAmount } from "@croco/credits-core";
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
  it.each([1, 100, 101, 1001])("finds the exact grant at position %i", async (position) => {
    const { adapter, grant } = await setup(position - 1);
    const target = await grant("target");
    expect(await adapter.check(input)).toEqual({ grantRef: target.transactions[0]?.id });
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
    const history = await ledger.getHistory(accountId, { afterPosition: 100 });
    expect(history.transactions.filter((entry) => entry.kind === "adjustment")).toHaveLength(1);
    expect(await ledger.getBalance(accountId)).toMatchObject({
      available: "700",
      netAdjusted: "-7",
    });
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
