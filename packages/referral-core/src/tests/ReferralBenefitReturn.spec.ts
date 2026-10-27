import { describe, expect, it } from "vitest";
import { CreditLedgerService, InMemoryCreditLedgerStore } from "@croco/credits-core";
import type { CreditAccountId } from "@croco/credits-core";
import { FirstPartyReferralCreditGrantAdapter } from "../credit-grant";
import { InMemoryReferralStore } from "../libs/InMemoryReferralStore";
import { ReferralService } from "../libs/ReferralService";
import {
  ReferralAttributionStateConflictProblem,
  ReferralBenefitFailedProblem,
} from "../libs/problems";
import type { ReferralTx } from "../libs/ReferralStore";
import type { ReferralFulfillmentPort } from "../libs/types";

function barrier() {
  let release = () => {};
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

async function setup(fulfillment: ReferralFulfillmentPort, store = new InMemoryReferralStore()) {
  let sequence = 0;
  const options: ConstructorParameters<typeof ReferralService>[0] = {
    store,
    tokens: { generateToken: () => "share-token", hashToken: () => "a".repeat(64) },
    novelty: () => ({ novelty: "new", reason: "signup" }),
    qualification: () => ({
      qualified: true,
      sourceEventId: "purchase-1",
      qualifyingAction: "purchase",
      eligibleReason: "paid",
    }),
    fulfillment,
    clock: () => new Date("2026-02-01T00:00:00Z"),
    idGenerator: () => `id-${++sequence}`,
  };
  const service = new ReferralService(options);
  const referrer = {
    appId: "shop",
    environment: "test",
    tenantId: "tenant",
    kind: "customer",
    id: "referrer",
  };
  const recipient = { ...referrer, id: "recipient" };
  await service.registerProgram({
    id: "program",
    version: 1,
    benefitCycleId: "cycle",
    conversionWindowMs: 86400000,
    qualifyingAction: "purchase",
    referrerBenefit: { kind: "trial-credits", creditAmount: "7" },
    recipientBenefit: { kind: "trial-credits", creditAmount: "3" },
    startsAt: new Date("2026-01-01T00:00:00Z"),
    endsAt: new Date("2026-12-31T00:00:00Z"),
    perSubjectLimit: 2,
    budgetTotal: "100",
    budgetPerAttribution: "10",
    actorId: "operator",
    reason: "launch",
    idempotencyKey: "register",
  });
  const { token } = await service.createReferralLink({ programId: "program", referrer });
  const { attribution } = await service.claimAttribution({ token, recipient });
  await service.qualifyAttribution({ attributionId: attribution.id, recipient });
  await service.fulfillBenefits({ attributionId: attribution.id });
  const request = {
    attributionId: attribution.id,
    side: "referrer" as const,
    policy: "duplicate",
    actorId: "operator",
    reason: "return reward",
    returnIdempotencyKey: "return-a",
  };
  return { service, store, request, restart: () => new ReferralService(options) };
}

const grants: ReferralFulfillmentPort = {
  fulfill: async ({ idempotencyKey }) => ({
    outcome: "granted",
    grantRef: `grant:${idempotencyKey}`,
  }),
  check: async () => null,
};

describe("ReferralBenefitReturn", () => {
  it("preserves completed-return conflicts for legacy intents without operation metadata", async () => {
    const { service, store, request } = await setup(grants);
    const intent = (
      await service.listBenefitIntents({ attributionId: request.attributionId })
    ).find((entry) => entry.side === "referrer");
    if (!intent) throw new Error("Missing referrer intent");
    await store.transact((tx) =>
      tx.compareAndSetBenefitIntent(
        intent.id,
        ["granted"],
        { status: "returned" },
        new Date("2026-02-01T00:00:00Z"),
      ),
    );
    await expect(service.returnBenefitSide(request)).rejects.toBeInstanceOf(
      ReferralAttributionStateConflictProblem,
    );
  });

  it("does not claim an operation when reversal is unsupported", async () => {
    const { service, request } = await setup(grants);
    await expect(service.returnBenefitSide(request)).rejects.toThrow(
      /does not support benefit return/,
    );
    const intent = (
      await service.listBenefitIntents({ attributionId: request.attributionId })
    ).find((entry) => entry.side === "referrer");
    expect(intent?.returnOperation).toBeUndefined();
    expect(intent?.status).toBe("granted");
  });
  it("reconciles a lost credit-ledger response with exactly one compensating debit", async () => {
    const ledger = new CreditLedgerService({
      store: new InMemoryCreditLedgerStore(),
      eventDelivery: "development",
    });
    const accounts = new Map<string, CreditAccountId>();
    for (const id of ["referrer", "recipient"]) {
      const { account } = await ledger.openAccount({
        tenantId: "tenant",
        walletKey: id,
        idempotencyKey: `open:${id}`,
        reference: { type: "customer", id },
      });
      accounts.set(id, account.id);
    }
    const accountFor = (id: string): CreditAccountId => {
      const account = accounts.get(id);
      if (!account) throw new Error(`Missing test account ${id}`);
      return account;
    };
    const adapter = new FirstPartyReferralCreditGrantAdapter({
      ledger,
      resolveAccount: ({ subject }) => accountFor(subject.id),
    });
    const { service, request, restart } = await setup({
      fulfill: (input) => adapter.fulfill(input),
      check: (input) => adapter.check(input),
      reverse: async (input) => {
        await adapter.reverse(input);
        throw new Error("lost debit response");
      },
      checkReturn: (input) => adapter.checkReturn(input),
    });
    await expect(service.returnBenefitSide(request)).rejects.toThrow(/lost debit response/);
    await restart().returnBenefitSide({ ...request, returnIdempotencyKey: "retry" });
    await expect(
      restart().returnBenefitSide({ ...request, returnIdempotencyKey: "another-retry" }),
    ).rejects.toBeInstanceOf(ReferralAttributionStateConflictProblem);
    expect(await ledger.getBalance(accountFor("referrer"))).toMatchObject({
      available: "0",
      netAdjusted: "-7",
    });
    expect(await ledger.getBalance(accountFor("recipient"))).toMatchObject({
      available: "3",
      netAdjusted: "0",
    });
    const history = await ledger.getHistory(accountFor("referrer"));
    expect(history.transactions.filter((entry) => entry.kind === "adjustment")).toHaveLength(1);
  });
  it("admits one external reversal when different return keys compete", async () => {
    const entered = barrier();
    const release = barrier();
    const keys: string[] = [];
    const { service, request } = await setup({
      ...grants,
      reverse: async ({ returnIdempotencyKey }) => {
        keys.push(returnIdempotencyKey);
        entered.release();
        if (keys.length === 1) await release.promise;
        return { returnRef: "return-receipt" };
      },
    });
    const first = service.returnBenefitSide(request);
    const settledFirst = Promise.allSettled([first]);
    await entered.promise;
    const second = await Promise.allSettled([
      service.returnBenefitSide({ ...request, returnIdempotencyKey: "return-b" }),
    ]);
    release.release();
    const [result] = await settledFirst;
    expect(keys).toEqual(["return-a"]);
    expect(result.status).toBe("fulfilled");
    expect(second[0].status).toBe("rejected");
    const intents = await service.listBenefitIntents({ attributionId: request.attributionId });
    expect(intents.find((intent) => intent.side === "referrer")).toMatchObject({
      status: "returned",
      receipt: expect.stringContaining("grant:"),
    });
    expect(intents.find((intent) => intent.side === "recipient")?.status).toBe("granted");
  });

  it.each(["throw", "error", "empty"] as const)(
    "recovers a %s response from the original receipt after restart",
    async (response) => {
      const keys: string[] = [];
      let visible = false;
      const checked: string[] = [];
      const { service, store, request, restart } = await setup({
        ...grants,
        reverse: async ({ returnIdempotencyKey }) => {
          keys.push(returnIdempotencyKey);
          if (response === "throw") throw new Error("response lost after debit");
          return response === "error" ? { error: "response lost after debit" } : { returnRef: "" };
        },
        checkReturn: async ({ returnIdempotencyKey }) => {
          checked.push(returnIdempotencyKey);
          return visible ? { returnRef: "durable-return" } : null;
        },
      });
      await expect(service.returnBenefitSide(request)).rejects.toBeInstanceOf(
        ReferralBenefitFailedProblem,
      );
      const restarted = restart();
      await expect(
        restarted.returnBenefitSide({ ...request, returnIdempotencyKey: "return-b" }),
      ).rejects.toThrow(/pending or uncertain/);
      const intents = await service.listBenefitIntents({ attributionId: request.attributionId });
      expect(intents.find((intent) => intent.side === "referrer")).toMatchObject({
        status: "granted",
        returnOperation: { status: "unknown", idempotencyKey: "return-a" },
      });
      visible = true;
      await restarted.returnBenefitSide({
        ...request,
        returnIdempotencyKey: "return-c",
        actorId: "retry-actor",
        policy: "retry-policy",
        reason: "retry-reason",
      });
      await expect(
        restarted.returnBenefitSide({ ...request, returnIdempotencyKey: "return-d" }),
      ).rejects.toBeInstanceOf(ReferralAttributionStateConflictProblem);
      expect(keys).toEqual(["return-a"]);
      expect(checked).toEqual(["return-a", "return-a"]);
      const completed = (
        await service.listBenefitIntents({ attributionId: request.attributionId })
      ).find((intent) => intent.side === "referrer");
      expect(completed?.returnOperation).toMatchObject({
        status: "returned",
        receipt: "durable-return",
        actorId: "operator",
        policy: "duplicate",
        reason: "return reward",
      });
      expect(
        (await store.listAudits()).filter((entry) => entry.action === "benefit.returned"),
      ).toMatchObject([
        {
          actorId: "operator",
          idempotencyKey: "return-a",
          reason: "duplicate: return reward (return durable-return)",
        },
      ]);
      expect(await store.readBudgetReserved("program", 1)).toBe("10");
    },
  );

  it("keeps an uncertain return locked when the port cannot query a receipt", async () => {
    let calls = 0;
    const { service, request, restart } = await setup({
      ...grants,
      reverse: async () => {
        calls++;
        throw new Error("disconnected");
      },
    });
    await expect(service.returnBenefitSide(request)).rejects.toThrow(/disconnected/);
    await expect(
      restart().returnBenefitSide({ ...request, returnIdempotencyKey: "retry" }),
    ).rejects.toThrow(/pending or uncertain/);
    expect(calls).toBe(1);
  });

  it("recovers a failed local return commit from a receipt without repeating the debit", async () => {
    class FailReturnCommitStore extends InMemoryReferralStore {
      fail = true;
      override transact<T>(work: (tx: ReferralTx) => Promise<T>): Promise<T> {
        return super.transact((tx) =>
          work(
            new Proxy(tx, {
              get: (target, key) => {
                if (key === "compareAndSetBenefitIntent")
                  return (...args: Parameters<ReferralTx["compareAndSetBenefitIntent"]>) => {
                    if (args[2].status === "returned" && this.fail) {
                      this.fail = false;
                      throw new Error("local write unavailable");
                    }
                    return target.compareAndSetBenefitIntent(...args);
                  };
                const value: unknown = Reflect.get(target, key);
                return typeof value === "function" ? value.bind(target) : value;
              },
            }),
          ),
        );
      }
    }
    let calls = 0;
    const { service, request, restart } = await setup(
      {
        ...grants,
        reverse: async () => {
          calls++;
          return { returnRef: "committed-debit" };
        },
        checkReturn: async () => ({ returnRef: "committed-debit" }),
      },
      new FailReturnCommitStore(),
    );
    await expect(service.returnBenefitSide(request)).rejects.toThrow(/local write unavailable/);
    const [pending] = (
      await service.listBenefitIntents({ attributionId: request.attributionId })
    ).filter((intent) => intent.side === "referrer");
    expect(pending.returnOperation?.status).toBe("returning");
    await restart().returnBenefitSide({ ...request, returnIdempotencyKey: "retry" });
    expect(calls).toBe(1);
  });
});
