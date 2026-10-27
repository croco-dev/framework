import { createHash } from "node:crypto";
import { CreditLedgerService, InMemoryCreditLedgerStore } from "@croco/credits-core";
import { describe, expect, it } from "vitest";
import { FirstPartyReferralCreditGrantAdapter } from "../credit-grant";
import { InMemoryReferralStore } from "../libs/InMemoryReferralStore";
import { registerReferralProgram } from "../libs/ReferralProgram";
import { ReferralService } from "../libs/ReferralService";
import {
  ReferralAttributionStateConflictProblem,
  ReferralBenefitFailedProblem,
  ReferralDuplicateClaimProblem,
  ReferralExistingCustomerProblem,
  ReferralLinkExpiredProblem,
  ReferralLinkRevokedProblem,
  ReferralQualificationRejectedProblem,
  ReferralSelfReferralProblem,
  ReferralSubjectLimitReachedProblem,
  ReferralTenantMismatchProblem,
} from "../libs/problems";
import { generateReferralToken, hashReferralToken } from "../libs/linkToken";
import type { ReferralTx } from "../libs/ReferralStore";
import type {
  ReferralFulfillmentPort,
  ReferralFulfillmentResult,
  ReferralSubject,
  RegisterReferralProgramInput,
} from "../libs/types";

const SCOPE = { appId: "shop", environment: "production", tenantId: "tenant-a" };

function referrer(): ReferralSubject {
  return { ...SCOPE, kind: "customer", id: "referrer-1" };
}

function recipient(id = "recipient-1"): ReferralSubject {
  return { ...SCOPE, kind: "customer", id };
}

function programInput(): RegisterReferralProgramInput {
  const now = new Date("2026-01-01T00:00:00Z");
  return {
    id: "referral-welcome",
    version: 1,
    benefitCycleId: "cycle-1",
    conversionWindowMs: 30 * 24 * 60 * 60 * 1000,
    qualifyingAction: "first-purchase",
    referrerBenefit: { kind: "trial-credits", creditAmount: "10" },
    recipientBenefit: { kind: "trial-credits", creditAmount: "5" },
    startsAt: now,
    endsAt: new Date("2026-12-31T00:00:00Z"),
    perSubjectLimit: 1,
    budgetTotal: "1000",
    budgetPerAttribution: "20",
    actorId: "operator-1",
    reason: "launch referral program",
    idempotencyKey: "program:referral-welcome:1",
  };
}

function fulfillmentOk(): ReferralFulfillmentPort {
  return {
    fulfill: async ({ idempotencyKey }) => ({
      outcome: "granted",
      grantRef: `grant:${idempotencyKey}`,
    }),
    check: async () => null,
    reverse: async ({ returnIdempotencyKey }) => ({ returnRef: `return:${returnIdempotencyKey}` }),
  };
}

// Keep production in-memory rollback outside this fix, but run the service suite
// with atomic test transactions so a callback throw cannot preserve writes.
class RollbackReferralStore extends InMemoryReferralStore {
  override async transact<T>(work: (tx: ReferralTx) => Promise<T>): Promise<T> {
    return super.transact(async (tx) => {
      const snapshot = Object.fromEntries(
        Object.entries(this)
          .filter(([, value]) => value instanceof Map || Array.isArray(value))
          .map(([key, value]) => [key, structuredClone(value)]),
      );
      try {
        return await work(tx);
      } catch (error) {
        Object.assign(this, snapshot);
        throw error;
      }
    });
  }
}

function serviceWith(overrides: Partial<ConstructorParameters<typeof ReferralService>[0]> = {}): {
  readonly service: ReferralService;
  readonly store: InMemoryReferralStore;
} {
  const store = new RollbackReferralStore();
  const service = new ReferralService({
    store,
    tokens: { generateToken: generateReferralToken, hashToken: hashReferralToken },
    novelty: () => ({ novelty: "new", reason: "authoritative signup source confirms new" }),
    qualification: () => ({
      qualified: true,
      sourceEventId: "event-1",
      qualifyingAction: "first-purchase",
      eligibleReason: "first purchase observed",
    }),
    fulfillment: fulfillmentOk(),
    clock: () => new Date("2026-02-01T00:00:00Z"),
    idGenerator: (() => {
      let next = 0;
      return () => `id-${(next += 1)}`;
    })(),
    ...overrides,
  });
  return { service, store };
}

describe("ReferralService", () => {
  it("registers a program and replays identical registration", async () => {
    const { service } = serviceWith();
    const first = await service.registerProgram(programInput());
    expect(first.created).toBe(true);
    expect(first.program.familyId).toBe("referral-welcome");
    const second = await service.registerProgram(programInput());
    expect(second.created).toBe(false);
  });

  it("creates a link whose stored row carries only the token hash", async () => {
    const { service, store } = serviceWith();
    await service.registerProgram(programInput());
    const { link, token } = await service.createReferralLink({
      programId: "referral-welcome",
      referrer: referrer(),
    });
    expect(token.length).toBeGreaterThan(16);
    expect(link.tokenHash).toBe(hashReferralToken(token));
    const stored = await store.getLinkByTokenHash(link.tokenHash);
    expect(stored?.id).toBe(link.id);
    expect(JSON.stringify(stored)).not.toContain(token);
  });

  it("claims first-valid attribution and holds a later duplicate without stealing", async () => {
    const { service, store } = serviceWith();
    await service.registerProgram(programInput());
    const first = await service.createReferralLink({
      programId: "referral-welcome",
      referrer: referrer(),
    });
    const second = await service.createReferralLink({
      programId: "referral-welcome",
      referrer: { ...SCOPE, kind: "customer", id: "referrer-2" },
    });
    const won = await service.claimAttribution({ token: first.token, recipient: recipient() });
    expect(won.firstValid).toBe(true);
    expect(won.attribution.state).toBe("claimed");
    await expect(
      service.claimAttribution({
        token: second.token,
        recipient: recipient(),
        attributionId: "duplicate",
      }),
    ).rejects.toBeInstanceOf(ReferralDuplicateClaimProblem);
    const kept = await service.getAttribution(won.attribution.id);
    expect(kept?.referrer.id).toBe("referrer-1");
    expect(await store.getAttribution("duplicate")).toMatchObject({
      state: "held",
      holdReason: "duplicate-claim",
    });
    await expect(
      service.qualifyAttribution({ attributionId: "duplicate", recipient: recipient() }),
    ).rejects.toBeInstanceOf(ReferralDuplicateClaimProblem);
    const replay = await service.claimAttribution({
      token: second.token,
      recipient: recipient(),
      attributionId: "duplicate",
    });
    expect(replay).toMatchObject({
      created: false,
      firstValid: false,
      attribution: { id: "duplicate" },
    });
    expect(
      (await store.listAudits()).filter((entry) => entry.action === "attribution.held-duplicate"),
    ).toHaveLength(1);
    expect(await store.readBudgetReserved("referral-welcome", 1)).toBe("20");
  });

  it("rejects self-referral, other-tenant links, revoked links, and expired links distinctly", async () => {
    const { service } = serviceWith();
    await service.registerProgram(programInput());
    const { token } = await service.createReferralLink({
      programId: "referral-welcome",
      referrer: referrer(),
    });
    await expect(service.claimAttribution({ token, recipient: referrer() })).rejects.toBeInstanceOf(
      ReferralSelfReferralProblem,
    );
    await expect(
      service.claimAttribution({
        token,
        recipient: {
          appId: "shop",
          environment: "production",
          tenantId: "tenant-b",
          kind: "customer",
          id: "x",
        },
      }),
    ).rejects.toBeInstanceOf(ReferralTenantMismatchProblem);
    const revoked = await service.createReferralLink({
      programId: "referral-welcome",
      referrer: referrer(),
    });
    const stored = await service.listAttributions({});
    void stored;
    await service.revokeLink({ linkId: revoked.link.id, actorId: "operator-1", reason: "abuse" });
    await expect(
      service.claimAttribution({ token: revoked.token, recipient: recipient("r-2") }),
    ).rejects.toBeInstanceOf(ReferralLinkRevokedProblem);
    const short = await service.createReferralLink({
      programId: "referral-welcome",
      referrer: referrer(),
      linkTtlMs: 60_000,
    });
    await expect(
      service.claimAttribution({
        token: short.token,
        recipient: recipient("r-3"),
        now: new Date("2026-06-01T00:00:00Z"),
      }),
    ).rejects.toBeInstanceOf(ReferralLinkExpiredProblem);
  });

  it("rejects existing customers and holds unknown novelty without silent success", async () => {
    const existing = serviceWith({
      novelty: () => ({ novelty: "existing", reason: "email already owns an order" }),
    });
    await existing.service.registerProgram(programInput());
    const link = await existing.service.createReferralLink({
      programId: "referral-welcome",
      referrer: referrer(),
    });
    await expect(
      existing.service.claimAttribution({ token: link.token, recipient: recipient() }),
    ).rejects.toBeInstanceOf(ReferralExistingCustomerProblem);

    const unknown = serviceWith({
      novelty: () => ({ novelty: "unknown", reason: "signup source timed out" }),
    });
    await unknown.service.registerProgram(programInput());
    const pending = await unknown.service.createReferralLink({
      programId: "referral-welcome",
      referrer: referrer(),
    });
    const held = await unknown.service.claimAttribution({
      token: pending.token,
      recipient: recipient(),
    });
    expect(held.attribution.state).toBe("held");
    expect(held.attribution.holdReason).toBe("unknown-novelty");
    expect(() => registerReferralProgram({ ...programInput(), id: "  " })).toThrow();
  });

  it("qualifies once and fulfills both sides with one benefit per side", async () => {
    const { service } = serviceWith();
    await service.registerProgram(programInput());
    const { token } = await service.createReferralLink({
      programId: "referral-welcome",
      referrer: referrer(),
    });
    const claimed = await service.claimAttribution({ token, recipient: recipient() });
    const qualified = await service.qualifyAttribution({
      attributionId: claimed.attribution.id,
      recipient: recipient(),
    });
    expect(["benefits-pending", "qualified"]).toContain(qualified.state);
    const fulfilled = await service.fulfillBenefits({ attributionId: claimed.attribution.id });
    expect(fulfilled.state).toBe("fulfilled");
    const intents = await service.listBenefitIntents({ attributionId: claimed.attribution.id });
    expect(intents).toHaveLength(2);
    expect(new Set(intents.map((intent) => intent.side)).size).toBe(2);
    expect(new Set(intents.map((intent) => intent.idempotencyKey)).size).toBe(2);
    const again = await service.fulfillBenefits({ attributionId: claimed.attribution.id });
    expect(again.state).toBe("fulfilled");
  });

  it("keeps partial success per side without re-paying the completed side", async () => {
    const grants: string[] = [];
    const flaky: ReferralFulfillmentPort = {
      fulfill: async ({ idempotencyKey, intent }) => {
        if (intent.side === "recipient") return { outcome: "failed", reason: "ledger declined" };
        grants.push(idempotencyKey);
        return { outcome: "granted", grantRef: `grant:${idempotencyKey}` };
      },
      check: async () => null,
    };
    const { service } = serviceWith({ fulfillment: flaky });
    await service.registerProgram(programInput());
    const { token } = await service.createReferralLink({
      programId: "referral-welcome",
      referrer: referrer(),
    });
    const claimed = await service.claimAttribution({ token, recipient: recipient() });
    await service.qualifyAttribution({
      attributionId: claimed.attribution.id,
      recipient: recipient(),
    });
    const partial = await service.fulfillBenefits({ attributionId: claimed.attribution.id });
    expect(partial.state).toBe("benefits-partial");
    const retry = await service.fulfillBenefits({ attributionId: claimed.attribution.id });
    expect(retry.state).toBe("benefits-partial");
    expect(grants).toHaveLength(1);
  });

  it("rejects qualification failures with a distinct problem and releases budget", async () => {
    const { service, store } = serviceWith({
      qualification: () => ({ qualified: false, reason: "no qualifying purchase in window" }),
    });
    await service.registerProgram(programInput());
    const { token } = await service.createReferralLink({
      programId: "referral-welcome",
      referrer: referrer(),
    });
    const claimed = await service.claimAttribution({ token, recipient: recipient() });
    await expect(
      service.qualifyAttribution({ attributionId: claimed.attribution.id, recipient: recipient() }),
    ).rejects.toBeInstanceOf(ReferralQualificationRejectedProblem);
    const stored = await store.getAttribution(claimed.attribution.id);
    expect(stored?.state).toBe("rejected");
    // A separate live reservation makes a second release observable.
    await service.claimAttribution({ token, recipient: recipient("other") });
    await expect(
      service.qualifyAttribution({ attributionId: claimed.attribution.id, recipient: recipient() }),
    ).rejects.toBeInstanceOf(ReferralAttributionStateConflictProblem);
    expect(await store.readBudgetReserved("referral-welcome", 1)).toBe("20");
    expect(
      (await store.listAudits()).filter((entry) => entry.action === "attribution.rejected"),
    ).toHaveLength(1);
  });

  it("recovers pending attributions after restart without duplicating benefits", async () => {
    const { service } = serviceWith();
    await service.registerProgram(programInput());
    const { token } = await service.createReferralLink({
      programId: "referral-welcome",
      referrer: referrer(),
    });
    const claimed = await service.claimAttribution({ token, recipient: recipient() });
    const pending = await service.recoverPendingAttributions({});
    expect(pending.map((entry) => entry.id)).toContain(claimed.attribution.id);
    await service.qualifyAttribution({
      attributionId: claimed.attribution.id,
      recipient: recipient(),
    });
    const fulfilled = await service.fulfillBenefits({ attributionId: claimed.attribution.id });
    expect(fulfilled.state).toBe("fulfilled");
    const afterRestart = await service.recoverPendingAttributions({});
    expect(afterRestart.map((entry) => entry.id)).not.toContain(claimed.attribution.id);
  });

  it("keeps receipt limits across revisions and unlocks a fresh explicit cycle", async () => {
    const { service } = serviceWith({ novelty: () => ({ novelty: "new", reason: "new" }) });
    await service.registerProgram(programInput());
    const firstLink = await service.createReferralLink({
      programId: "referral-welcome",
      referrer: referrer(),
    });
    const firstClaim = await service.claimAttribution({
      token: firstLink.token,
      recipient: recipient(),
    });
    await service.qualifyAttribution({
      attributionId: firstClaim.attribution.id,
      recipient: recipient(),
    });
    await service.fulfillBenefits({ attributionId: firstClaim.attribution.id });
    await service.registerProgram({ ...programInput(), version: 2 });
    const secondLink = await service.createReferralLink({
      programId: "referral-welcome",
      programVersion: 2,
      referrer: { ...SCOPE, kind: "customer", id: "referrer-2" },
    });
    await expect(
      service.claimAttribution({ token: secondLink.token, recipient: recipient() }),
    ).rejects.toBeInstanceOf(ReferralDuplicateClaimProblem);
    await service.registerProgram({
      ...programInput(),
      version: 3,
      benefitCycleId: "cycle-2",
      idempotencyKey: "program:referral-welcome:3",
    });
    const thirdLink = await service.createReferralLink({
      programId: "referral-welcome",
      programVersion: 3,
      referrer: { ...SCOPE, kind: "customer", id: "referrer-3" },
    });
    const thirdClaim = await service.claimAttribution({
      token: thirdLink.token,
      recipient: recipient("recipient-2"),
    });
    expect(thirdClaim.firstValid).toBe(true);
  });

  it("admits only one preclaimed referral per subject and replays its existing receipts", async () => {
    const grants: string[] = [];
    const { service, store } = serviceWith({
      fulfillment: {
        ...fulfillmentOk(),
        fulfill: async ({ idempotencyKey }) => {
          grants.push(idempotencyKey);
          return { outcome: "granted", grantRef: `grant:${idempotencyKey}` };
        },
      },
    });
    await service.registerProgram(programInput());
    const { token } = await service.createReferralLink({
      programId: "referral-welcome",
      referrer: referrer(),
    });
    const first = await service.claimAttribution({ token, recipient: recipient("one") });
    const second = await service.claimAttribution({ token, recipient: recipient("two") });
    const input = { attributionId: first.attribution.id, recipient: recipient("one") };
    const qualified = await service.qualifyAttribution(input);
    expect(await service.qualifyAttribution(input)).toEqual(qualified);
    await expect(
      service.qualifyAttribution({
        attributionId: second.attribution.id,
        recipient: recipient("two"),
      }),
    ).rejects.toBeInstanceOf(ReferralSubjectLimitReachedProblem);
    expect((await store.getAttribution(second.attribution.id))?.state).toBe("claimed");
    expect(await service.listBenefitIntents({ attributionId: second.attribution.id })).toEqual([]);
    expect(await store.transact((tx) => tx.readBudgetReserved("referral-welcome", 1))).toBe("40");
    const fulfilled = await service.fulfillBenefits({ attributionId: first.attribution.id });
    expect(await service.fulfillBenefits({ attributionId: first.attribution.id })).toEqual(
      fulfilled,
    );
    expect(grants).toEqual([
      `referral-benefit:${first.attribution.id}:referrer`,
      `referral-benefit:${first.attribution.id}:recipient`,
    ]);
  });

  it.each(["rejected", "expired", "benefits-partial", "indeterminate"] as const)(
    "applies subject limit semantics after %s",
    async (state) => {
      const { service, store } = serviceWith({
        qualification: ({ recipient: who }) =>
          who.id === "one" && state === "rejected"
            ? { qualified: false, reason: "not eligible" }
            : {
                qualified: true,
                sourceEventId: "purchase",
                qualifyingAction: "first-purchase",
                eligibleReason: "paid",
              },
        fulfillment: {
          ...fulfillmentOk(),
          fulfill: async ({ intent }) =>
            intent.side === "referrer"
              ? { outcome: "granted", grantRef: "grant-one" }
              : state === "indeterminate"
                ? { outcome: "unknown", reason: "response lost" }
                : { outcome: "failed", reason: "temporarily unavailable", retryable: true },
        },
      });
      await service.registerProgram(programInput());
      const { token } = await service.createReferralLink({
        programId: "referral-welcome",
        referrer: referrer(),
      });
      const first = await service.claimAttribution({ token, recipient: recipient("one") });
      const second = await service.claimAttribution({ token, recipient: recipient("two") });
      const qualification = service.qualifyAttribution({
        attributionId: first.attribution.id,
        recipient: recipient("one"),
        ...(state === "expired" ? { now: new Date("2026-03-04T00:00:00Z") } : {}),
      });
      if (state === "rejected")
        await expect(qualification).rejects.toBeInstanceOf(ReferralQualificationRejectedProblem);
      else await qualification;
      if (state === "benefits-partial" || state === "indeterminate")
        await service.fulfillBenefits({ attributionId: first.attribution.id });
      expect((await store.getAttribution(first.attribution.id))?.state).toBe(state);
      const next = service.qualifyAttribution({
        attributionId: second.attribution.id,
        recipient: recipient("two"),
      });
      if (state === "rejected" || state === "expired") {
        expect((await next).state).toBe("benefits-pending");
        expect(await store.transact((tx) => tx.readBudgetReserved("referral-welcome", 1))).toBe(
          "20",
        );
      } else {
        await expect(next).rejects.toBeInstanceOf(ReferralSubjectLimitReachedProblem);
        expect(await service.listBenefitIntents({ attributionId: second.attribution.id })).toEqual(
          [],
        );
        expect(await store.transact((tx) => tx.readBudgetReserved("referral-welcome", 1))).toBe(
          "40",
        );
      }
    },
  );

  it.each(["revision", "cycle", "family", "tenant"] as const)(
    "scopes subject limits by %s",
    async (boundary) => {
      const { service } = serviceWith();
      const base = programInput();
      await service.registerProgram(base);
      const { token } = await service.createReferralLink({
        programId: base.id,
        referrer: referrer(),
      });
      const first = await service.claimAttribution({ token, recipient: recipient("one") });
      const nextProgram = {
        ...base,
        version: 2,
        idempotencyKey: "program-two",
        ...(boundary === "cycle" ? { benefitCycleId: "cycle-two" } : {}),
        ...(boundary === "family" ? { familyId: "family-two" } : {}),
      };
      await service.registerProgram(nextProgram);
      const nextReferrer = {
        ...referrer(),
        ...(boundary === "tenant" ? { tenantId: "tenant-b" } : {}),
      };
      const nextRecipient = { ...recipient("two"), tenantId: nextReferrer.tenantId };
      const secondLink = await service.createReferralLink({
        programId: base.id,
        programVersion: 2,
        referrer: nextReferrer,
      });
      const second = await service.claimAttribution({
        token: secondLink.token,
        recipient: nextRecipient,
      });
      await service.qualifyAttribution({
        attributionId: first.attribution.id,
        recipient: recipient("one"),
      });
      const next = service.qualifyAttribution({
        attributionId: second.attribution.id,
        recipient: nextRecipient,
      });
      if (boundary === "revision")
        await expect(next).rejects.toBeInstanceOf(ReferralSubjectLimitReachedProblem);
      else expect((await next).state).toBe("benefits-pending");
    },
  );

  it("counts the recipient's earlier referrer receipt in the same family and cycle", async () => {
    const { service } = serviceWith();
    await service.registerProgram(programInput());
    const linkA = await service.createReferralLink({
      programId: "referral-welcome",
      referrer: recipient("shared"),
    });
    const first = await service.claimAttribution({
      token: linkA.token,
      recipient: recipient("one"),
    });
    const linkB = await service.createReferralLink({
      programId: "referral-welcome",
      referrer: referrer(),
    });
    const second = await service.claimAttribution({
      token: linkB.token,
      recipient: recipient("shared"),
    });
    await service.qualifyAttribution({
      attributionId: first.attribution.id,
      recipient: recipient("one"),
    });
    await expect(
      service.qualifyAttribution({
        attributionId: second.attribution.id,
        recipient: recipient("shared"),
      }),
    ).rejects.toThrow("recipient already reached the limit");
  });

  it("derives cycle index from the referrer's confirmed attribution chain", async () => {
    const { service } = serviceWith();
    await service.registerProgram({ ...programInput(), perSubjectLimit: 5 });
    const invite = await service.createReferralLink({
      programId: "referral-welcome",
      referrer: referrer(),
    });
    const first = await service.claimAttribution({ token: invite.token, recipient: recipient() });
    expect(first.attribution.cycleIndex).toBe(1);
    await service.qualifyAttribution({
      attributionId: first.attribution.id,
      recipient: recipient(),
    });
    await service.fulfillBenefits({ attributionId: first.attribution.id });
    const chain = await service.createReferralLink({
      programId: "referral-welcome",
      referrer: recipient(),
    });
    const second = await service.claimAttribution({
      token: chain.token,
      recipient: recipient("recipient-2"),
    });
    expect(second.attribution.cycleIndex).toBe(2);
  });

  it("counts real clicks instead of reporting acquisition as success", async () => {
    const { service } = serviceWith();
    await service.registerProgram(programInput());
    const { link, token } = await service.createReferralLink({
      programId: "referral-welcome",
      referrer: referrer(),
    });
    for (let index = 0; index < 100; index += 1) {
      await service.recordClick({ linkId: link.id });
    }
    const claimed = await service.claimAttribution({ token, recipient: recipient() });
    await service.qualifyAttribution({
      attributionId: claimed.attribution.id,
      recipient: recipient(),
    });
    await service.fulfillBenefits({ attributionId: claimed.attribution.id });
    const funnel = await service.funnelCounts({ programId: "referral-welcome" });
    expect(funnel.clicks).toBe(100);
    expect(funnel.qualified).toBe(1);
    expect(funnel.fulfilled).toBe(1);
    expect(funnel.clicks).not.toBe(funnel.fulfilled);
  });

  it("cancels a pending side and returns a granted side with explicit policy", async () => {
    const { service } = serviceWith();
    await service.registerProgram(programInput());
    const { token } = await service.createReferralLink({
      programId: "referral-welcome",
      referrer: referrer(),
    });
    const claimed = await service.claimAttribution({ token, recipient: recipient() });
    await service.qualifyAttribution({
      attributionId: claimed.attribution.id,
      recipient: recipient(),
    });
    const canceled = await service.cancelBenefitSide({
      attributionId: claimed.attribution.id,
      side: "recipient",
      actorId: "operator-1",
      reason: "recipient asked to decline",
      policy: "voluntary-decline",
    });
    expect(canceled.state).toBe("benefits-partial");
    const intents = await service.listBenefitIntents({ attributionId: claimed.attribution.id });
    expect(intents.find((intent) => intent.side === "recipient")?.status).toBe("canceled");
    const fulfilled = await service.fulfillBenefits({ attributionId: claimed.attribution.id });
    expect(fulfilled.state).toBe("fulfilled");
    const returned = await service.returnBenefitSide({
      attributionId: claimed.attribution.id,
      side: "referrer",
      policy: "fraud-reversal",
      actorId: "operator-1",
      reason: "confirmed abuse after payout",
    });
    expect(returned.state).toBe("fulfilled");
    const afterReturn = await service.listBenefitIntents({
      attributionId: claimed.attribution.id,
    });
    expect(afterReturn.find((intent) => intent.side === "referrer")?.status).toBe("returned");
  });

  it("rejects benefit return when fulfillment has no reverse support", async () => {
    const { service } = serviceWith({
      fulfillment: {
        fulfill: async ({ idempotencyKey }) => ({
          outcome: "granted",
          grantRef: `grant:${idempotencyKey}`,
        }),
        check: async () => null,
      },
    });
    await service.registerProgram(programInput());
    const { token } = await service.createReferralLink({
      programId: "referral-welcome",
      referrer: referrer(),
    });
    const claimed = await service.claimAttribution({ token, recipient: recipient() });
    await service.qualifyAttribution({
      attributionId: claimed.attribution.id,
      recipient: recipient(),
    });
    await service.fulfillBenefits({ attributionId: claimed.attribution.id });
    await expect(
      service.returnBenefitSide({
        attributionId: claimed.attribution.id,
        side: "referrer",
        policy: "fraud-reversal",
        actorId: "operator-1",
        reason: "confirmed abuse after payout",
      }),
    ).rejects.toBeInstanceOf(ReferralBenefitFailedProblem);
  });
});

describe("ReferralService granting recovery", () => {
  const now = new Date("2026-02-01T00:00:00Z");
  const scope = { appId: "shop", environment: "test", tenantId: "tenant", kind: "customer" };
  function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((done) => {
      resolve = done;
    });
    return { promise, resolve };
  }

  async function claimSetup(fulfillment: ReferralFulfillmentPort, unknownNovelty = false) {
    const store = new InMemoryReferralStore();
    const restart = () =>
      new ReferralService({
        store,
        tokens: {
          generateToken: () => "test-token",
          hashToken: (token) => createHash("sha256").update(token).digest("hex"),
        },
        novelty: () => ({ novelty: unknownNovelty ? "unknown" : "new", reason: "signup" }),
        qualification: () => ({
          qualified: true,
          sourceEventId: "purchase",
          qualifyingAction: "purchase",
          eligibleReason: "paid",
        }),
        fulfillment,
        clock: () => now,
      });
    const service = restart();
    await service.registerProgram({
      id: "program",
      version: 1,
      benefitCycleId: "cycle",
      conversionWindowMs: 86400000,
      qualifyingAction: "purchase",
      referrerBenefit: { kind: "trial-credits", creditAmount: "7" },
      recipientBenefit: { kind: "trial-credits", creditAmount: "3" },
      startsAt: new Date("2026-01-01Z"),
      endsAt: new Date("2027-01-01Z"),
      perSubjectLimit: 1,
      budgetTotal: "20",
      budgetPerAttribution: "10",
      actorId: "operator",
      reason: "launch",
      idempotencyKey: "program",
    });
    const recipient = { ...scope, id: "recipient" };
    const { token } = await service.createReferralLink({
      programId: "program",
      referrer: { ...scope, id: "referrer" },
    });
    const { attribution } = await service.claimAttribution({ token, recipient });
    return { service, store, restart, attributionId: attribution.id, recipient };
  }

  async function setup(fulfillment: ReferralFulfillmentPort) {
    const seeded = await claimSetup(fulfillment);
    const { service, store, attributionId, recipient } = seeded;
    await service.qualifyAttribution({ attributionId, recipient });
    const intents = await service.listBenefitIntents({ attributionId });
    const referrer = intents.find((intent) => intent.side === "referrer")!;
    await store.transact((tx) =>
      tx.compareAndSetBenefitIntent(referrer.id, ["pending"], { status: "granting" }, now),
    );
    return { ...seeded, referrer };
  }

  function port() {
    const payments = new Map<string, string>();
    const calls: string[] = [];
    const fulfillment: ReferralFulfillmentPort = {
      fulfill: async ({ idempotencyKey }) => {
        calls.push(idempotencyKey);
        const receipt = payments.get(idempotencyKey) ?? `receipt:${idempotencyKey}`;
        payments.set(idempotencyKey, receipt);
        return { outcome: "granted", grantRef: receipt };
      },
      check: async ({ idempotencyKey }) => {
        const grantRef = payments.get(idempotencyKey);
        return grantRef ? { grantRef } : null;
      },
    };
    return { fulfillment, calls, payments };
  }

  it.each([false, true])(
    "does not grant unqualified attributions (unknown novelty: %s)",
    async (unknownNovelty) => {
      const { fulfillment, calls } = port();
      const { restart, store, attributionId } = await claimSetup(fulfillment, unknownNovelty);
      expect((await restart().reconcileBenefits({ attributionId })).state).toBe(
        unknownNovelty ? "held" : "claimed",
      );
      expect(await store.listBenefitIntents({ attributionId })).toEqual([]);
      expect(calls).toEqual([]);
    },
  );

  it("finishes both sides after restart between granting persistence and the external call", async () => {
    const { fulfillment, calls, payments } = port();
    const { restart, attributionId, referrer } = await setup(fulfillment);
    expect((await restart().reconcileBenefits({ attributionId })).state).toBe("fulfilled");
    expect(calls).toContain(referrer.idempotencyKey);
    expect(payments.size).toBe(2);
    expect((await restart().reconcileBenefits({ attributionId })).state).toBe("fulfilled");
    expect(calls).toHaveLength(2);
  });

  it("uses a durable receipt after response loss without invoking fulfillment for that side", async () => {
    const { fulfillment, calls, payments } = port();
    const { restart, attributionId, referrer } = await setup(fulfillment);
    payments.set(referrer.idempotencyKey, "previous-grant");
    expect((await restart().reconcileBenefits({ attributionId })).state).toBe("fulfilled");
    expect(calls).not.toContain(referrer.idempotencyKey);
    expect(payments.size).toBe(2);
  });

  it.each(["unknown", "failed", "skipped", "granted", "throw"] as const)(
    "fences a late %s response after a second recovery completes the same idempotent grant",
    async (late) => {
      const { fulfillment, calls, payments } = port();
      const started = deferred<void>();
      const finish = deferred<ReferralFulfillmentResult>();
      let first = true;
      const original = fulfillment.fulfill;
      fulfillment.fulfill = async (input) => {
        if (input.intent.side === "referrer" && first) {
          first = false;
          // The external system has committed, but its response and check visibility lag.
          const result = await original(input);
          started.resolve();
          await finish.promise;
          if (late === "throw") throw new Error("lost response");
          return late === "granted" ? result : { outcome: late, reason: "late result" };
        }
        return original(input);
      };
      fulfillment.check = async () => null;
      const { restart, store, attributionId, referrer } = await setup(fulfillment);
      const old = restart().reconcileBenefits({ attributionId });
      const settled = old.then(
        () => null,
        (error: unknown) => error,
      );
      await started.promise;
      expect((await restart().reconcileBenefits({ attributionId })).state).toBe("fulfilled");
      finish.resolve({ outcome: "unknown", reason: "release" });
      await settled;
      expect((await store.getBenefitIntent(referrer.id))?.status).toBe("granted");
      expect((await store.getAttribution(attributionId))?.state).toBe("fulfilled");
      expect(payments.size).toBe(2);
      expect(calls.filter((key) => key === referrer.idempotencyKey)).toHaveLength(2);
      expect(await store.readBudgetReserved("program", 1)).toBe("10");
      expect(
        (await store.listAudits()).filter((entry) => entry.action === "benefit.granted"),
      ).toHaveLength(2);
    },
  );

  it("fences a superseded response while the current recovery is still granting", async () => {
    const { fulfillment, payments } = port();
    const firstStarted = deferred<void>();
    const secondStarted = deferred<void>();
    const firstFinish = deferred<ReferralFulfillmentResult>();
    const secondFinish = deferred<ReferralFulfillmentResult>();
    const original = fulfillment.fulfill;
    let attempts = 0;
    fulfillment.fulfill = async (input) => {
      if (input.intent.side !== "referrer") return original(input);
      const attempt = ++attempts;
      const result = await original(input);
      if (attempt === 1) {
        firstStarted.resolve();
        return firstFinish.promise;
      }
      secondStarted.resolve();
      await secondFinish.promise;
      return result;
    };
    fulfillment.check = async () => null;
    const { restart, store, attributionId, referrer } = await setup(fulfillment);
    const old = restart().reconcileBenefits({ attributionId });
    await firstStarted.promise;
    const current = restart().reconcileBenefits({ attributionId });
    await secondStarted.promise;
    firstFinish.resolve({ outcome: "unknown", reason: "superseded timeout" });
    await old;
    expect((await store.getBenefitIntent(referrer.id))?.status).toBe("granting");
    secondFinish.resolve({ outcome: "granted", grantRef: "release" });
    expect((await current).state).toBe("fulfilled");
    expect(payments.size).toBe(2);
    expect(await store.readBudgetReserved("program", 1)).toBe("10");
  });

  it("lets only one of two recoveries claim the same observed granting attempt", async () => {
    const { fulfillment, calls, payments } = port();
    const checksStarted = deferred<void>();
    const releaseChecks = deferred<void>();
    let checks = 0;
    fulfillment.check = async () => {
      if (++checks === 2) checksStarted.resolve();
      await releaseChecks.promise;
      return null;
    };
    const { restart, attributionId, referrer } = await setup(fulfillment);
    const left = restart().reconcileBenefits({ attributionId });
    const right = restart().reconcileBenefits({ attributionId });
    await checksStarted.promise;
    releaseChecks.resolve();
    const results = await Promise.all([left, right]);
    expect(results.some((result) => result.state === "fulfilled")).toBe(true);
    expect(calls.filter((key) => key === referrer.idempotencyKey)).toHaveLength(1);
    expect(payments.size).toBe(2);
    expect((await restart().reconcileBenefits({ attributionId })).state).toBe("fulfilled");
  });

  it("posts one real ledger grant per side when a response is lost and recovery overlaps", async () => {
    const ledger = new CreditLedgerService({
      store: new InMemoryCreditLedgerStore(),
      eventDelivery: "development",
      clock: () => now,
    });
    const referrerAccount = (
      await ledger.openAccount({
        tenantId: "tenant",
        idempotencyKey: "open-referrer",
        walletKey: "referrer",
        reference: { type: "test", id: "referrer" },
      })
    ).account.id;
    const recipientAccount = (
      await ledger.openAccount({
        tenantId: "tenant",
        idempotencyKey: "open-recipient",
        walletKey: "recipient",
        reference: { type: "test", id: "recipient" },
      })
    ).account.id;
    const adapter = new FirstPartyReferralCreditGrantAdapter({
      ledger,
      resolveAccount: ({ side }) => (side === "referrer" ? referrerAccount : recipientAccount),
    });
    const started = deferred<void>();
    const release = deferred<void>();
    let first = true;
    const fulfillment: ReferralFulfillmentPort = {
      check: async () => null,
      fulfill: async (input) => {
        const result = await adapter.fulfill(input);
        if (input.intent.side === "referrer" && first) {
          first = false;
          started.resolve();
          await release.promise;
          return { outcome: "unknown", reason: "response lost after commit" };
        }
        return result;
      },
    };
    const { restart, attributionId } = await setup(fulfillment);
    const pending = restart().reconcileBenefits({ attributionId });
    await started.promise;
    expect((await restart().reconcileBenefits({ attributionId })).state).toBe("fulfilled");
    release.resolve();
    await pending;
    const referrerHistory = await ledger.getHistory(referrerAccount, { limit: 100 });
    const recipientHistory = await ledger.getHistory(recipientAccount, { limit: 100 });
    expect(
      referrerHistory.transactions.filter((tx) => tx.kind === "grant").map((tx) => tx.amount),
    ).toEqual(["7"]);
    expect(
      recipientHistory.transactions.filter((tx) => tx.kind === "grant").map((tx) => tx.amount),
    ).toEqual(["3"]);
  });

  it("preserves operator fulfillment when a receipt check returns after settlement", async () => {
    const started = deferred<void>();
    const release = deferred<void>();
    const calls: string[] = [];
    const fulfillment: ReferralFulfillmentPort = {
      fulfill: async ({ intent }) => {
        calls.push(intent.side);
        if (intent.side === "referrer") throw new Error("response lost");
        return { outcome: "granted", grantRef: "unexpected-recipient-grant" };
      },
      check: async () => {
        started.resolve();
        await release.promise;
        return { grantRef: "settled-referrer" };
      },
    };
    const { service, restart, store, attributionId, recipient } = await claimSetup(fulfillment);
    await service.qualifyAttribution({ attributionId, recipient });
    await expect(service.fulfillBenefits({ attributionId })).rejects.toThrow("response lost");
    expect((await store.getAttribution(attributionId))?.state).toBe("indeterminate");
    const pending = restart().reconcileBenefits({ attributionId });
    await started.promise;
    await restart().resolveIndeterminateBenefits({
      attributionId,
      decision: "fulfilled",
      grantRefs: { referrer: "settled-referrer", recipient: "settled-recipient" },
      actorId: "operator",
      reason: "verified external settlement of both sides",
    });
    release.resolve();
    expect((await pending).state).toBe("fulfilled");
    expect(calls).toEqual(["referrer"]);
    expect(await store.readBudgetReserved("program", 1)).toBe("10");
  });

  it("preserves an operator rejection and released budget when an older grant completes late", async () => {
    const started = deferred<void>();
    const release = deferred<void>();
    const fulfillment: ReferralFulfillmentPort = {
      check: async () => null,
      fulfill: async () => {
        started.resolve();
        await release.promise;
        return { outcome: "granted", grantRef: "late-grant" };
      },
    };
    const { restart, store, attributionId } = await setup(fulfillment);
    const recipientIntent = (await store.listBenefitIntents({ attributionId })).find(
      (intent) => intent.side === "recipient",
    )!;
    await store.transact((tx) =>
      tx.compareAndSetBenefitIntent(
        recipientIntent.id,
        ["pending"],
        { status: "unknown", reason: "prior uncertain call" },
        now,
      ),
    );
    const pending = restart().reconcileBenefits({ attributionId });
    await started.promise;
    expect((await restart().fulfillBenefits({ attributionId })).state).toBe("indeterminate");
    await restart().resolveIndeterminateBenefits({
      attributionId,
      decision: "rejected",
      actorId: "operator",
      reason: "manual external settlement",
    });
    release.resolve();
    expect((await pending).state).toBe("rejected");
    expect(await store.readBudgetReserved("program", 1)).toBe("0");
    expect(
      (await store.listAudits()).filter(
        (entry) => entry.action === "attribution.rejected-by-operator",
      ),
    ).toHaveLength(1);
    const lateGrants = (await store.listAudits()).filter(
      (entry) => entry.action === "benefit.grant-superseded",
    );
    expect(lateGrants).toHaveLength(1);
    expect(lateGrants[0]).toMatchObject({
      targetKind: "benefit",
      targetId: `${attributionId}:referrer`,
      idempotencyKey: `referral-benefit:${attributionId}:referrer`,
      reason: "late grant late-grant after attribution rejected",
    });
  });

  it("keeps unknown outcomes locked until an explicit operator decision", async () => {
    const { fulfillment, calls } = port();
    const { restart, store, attributionId, referrer } = await setup(fulfillment);
    await store.transact((tx) =>
      tx.compareAndSetBenefitIntent(referrer.id, ["granting"], { status: "unknown" }, now),
    );
    expect((await restart().reconcileBenefits({ attributionId })).state).toBe("indeterminate");
    expect(calls).not.toContain(referrer.idempotencyKey);
    expect(await store.readBudgetReserved("program", 1)).toBe("10");
    await restart().resolveIndeterminateBenefits({
      attributionId,
      decision: "rejected",
      actorId: "operator",
      reason: "verified absent",
    });
    expect(await store.readBudgetReserved("program", 1)).toBe("0");
    expect((await restart().reconcileBenefits({ attributionId })).state).toBe("rejected");
  });
});
