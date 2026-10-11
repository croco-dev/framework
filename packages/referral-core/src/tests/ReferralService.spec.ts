import { describe, expect, it } from "vitest";
import { InMemoryReferralStore } from "../libs/InMemoryReferralStore";
import { registerReferralProgram } from "../libs/ReferralProgram";
import { ReferralService } from "../libs/ReferralService";
import {
  ReferralBenefitFailedProblem,
  ReferralDuplicateClaimProblem,
  ReferralExistingCustomerProblem,
  ReferralLinkExpiredProblem,
  ReferralLinkRevokedProblem,
  ReferralQualificationRejectedProblem,
  ReferralSelfReferralProblem,
  ReferralTenantMismatchProblem,
} from "../libs/problems";
import { generateReferralToken, hashReferralToken } from "../libs/linkToken";
import type {
  ReferralFulfillmentPort,
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

function serviceWith(overrides: Partial<ConstructorParameters<typeof ReferralService>[0]> = {}): {
  readonly service: ReferralService;
  readonly store: InMemoryReferralStore;
} {
  const store = new InMemoryReferralStore();
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
    const { service } = serviceWith();
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
      service.claimAttribution({ token: second.token, recipient: recipient() }),
    ).rejects.toBeInstanceOf(ReferralDuplicateClaimProblem);
    const kept = await service.getAttribution(won.attribution.id);
    expect(kept?.referrer.id).toBe("referrer-1");
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
