import { describe, expect, it } from "vitest";
import { atomicStoreConformance } from "../../../../test-support/atomicStoreConformance";
import { InMemoryReferralStore } from "../libs/InMemoryReferralStore";
import { attributionFingerprint } from "../libs/ReferralStore";
import { hashReferralToken } from "../libs/linkToken";
import { ReferralService } from "../libs/ReferralService";
import {
  ReferralAttributionNotFoundProblem,
  ReferralBudgetExhaustedProblem,
  ReferralDuplicateClaimProblem,
} from "../libs/problems";
import type { ReferralTx } from "../libs/ReferralStore";
import type {
  ReferralAttribution,
  ReferralBenefitIntent,
  ReferralLink,
  ReferralProgramDefinition,
} from "../libs/types";

const now = new Date("2026-10-01T00:00:00Z");
const scope = { appId: "shop", environment: "test", tenantId: "a" };
const referrer = { ...scope, kind: "customer", id: "one" };
const recipient = { ...referrer, id: "two" };
const program: ReferralProgramDefinition = {
  id: "welcome",
  version: 1,
  familyId: "welcome",
  benefitCycleId: "q4",
  attributionPolicy: "first-valid",
  conversionWindowMs: 86400000,
  qualifyingAction: "purchase",
  referrerBenefit: {
    kind: "trial-credits",
    creditAmount: "10",
    expiresAt: new Date("2027-02-01T00:00:00Z"),
  },
  recipientBenefit: { kind: "trial-credits", creditAmount: "5" },
  startsAt: now,
  endsAt: new Date("2027-01-01T00:00:00Z"),
  perSubjectLimit: 10,
  budgetTotal: "100",
  budgetPerAttribution: "15",
  actorId: "operator",
  reason: "test",
  idempotencyKey: "program",
  registeredAt: now,
};
const link: ReferralLink = {
  id: "link",
  tokenHash: "hash",
  programId: program.id,
  programVersion: 1,
  familyId: "welcome",
  benefitCycleId: "q4",
  referrer,
  createdAt: now,
  expiresAt: program.endsAt,
};
const attribution: ReferralAttribution = {
  ...link,
  id: "attribution",
  linkId: link.id,
  scope,
  recipient,
  claimedAt: now,
  state: "claimed",
  cycleIndex: 0,
  updatedAt: now,
};
const intent: ReferralBenefitIntent = {
  id: "intent",
  attributionId: attribution.id,
  side: "referrer",
  logicalKey: "intent-logical",
  idempotencyKey: "intent",
  subject: referrer,
  benefit: program.referrerBenefit,
  status: "pending",
  createdAt: now,
  updatedAt: now,
};
const audit = {
  auditId: "audit",
  targetKind: "attribution" as const,
  targetId: attribution.id,
  action: "claimed",
  actorId: "operator",
  reason: "test",
  revision: "1",
  idempotencyKey: "audit",
  recordedAt: now,
};

atomicStoreConformance<ReferralTx>(
  "InMemoryReferralStore",
  [
    "saveProgram",
    "saveLink and token index",
    "revokeLink",
    "recordClick",
    "saveAttribution and fingerprint",
    "compareAndSetAttribution",
    "saveBenefitIntent and logical index",
    "compareAndSetBenefitIntent",
    "addBudgetReservation",
    "releaseBudgetReservation",
    "recordAudit",
  ],
  async () => {
    const store = new InMemoryReferralStore();
    await store.transact(async (tx) => {
      await tx.saveProgram(program);
      await tx.saveLink(link);
      await tx.recordClick(link.id, now);
      await tx.saveAttribution(attribution, attributionFingerprint(attribution));
      await tx.saveBenefitIntent(intent);
      await tx.addBudgetReservation(program.id, 1, "15");
      await tx.recordAudit(audit);
    });
    const added = {
      ...attribution,
      id: "new-attribution",
      recipient: { ...recipient, id: "three" },
    };
    return {
      transact: (work) => store.transact(work),
      writes: [
        (tx) => tx.saveProgram({ ...program, version: 2 }),
        (tx) => tx.saveLink({ ...link, id: "new-link", tokenHash: "new-hash" }),
        (tx) => tx.revokeLink(link.id, program.endsAt),
        (tx) => tx.recordClick(link.id, now),
        (tx) => tx.saveAttribution(added, attributionFingerprint(added)),
        (tx) =>
          tx.compareAndSetAttribution(attribution.id, ["claimed"], {
            ...attribution,
            state: "qualified",
            qualification: {
              sourceEventId: "event",
              qualifyingAction: "purchase",
              qualifiedAt: now,
              eligibleReason: "valid",
            },
          }),
        (tx) => tx.saveBenefitIntent({ ...intent, id: "new-intent", logicalKey: "new-logical" }),
        (tx) =>
          tx.compareAndSetBenefitIntent(
            intent.id,
            ["pending"],
            { status: "granted", receipt: "receipt" },
            program.endsAt,
          ),
        (tx) => tx.addBudgetReservation(program.id, 1, "17"),
        (tx) => tx.releaseBudgetReservation(program.id, 1, "4"),
        (tx) => tx.recordAudit({ ...audit, auditId: "new-audit" }),
      ],
      read: async (tx = store) => ({
        programs: await Promise.all([1, 2].map((version) => tx.getProgram(program.id, version))),
        latest: await tx.latestProgramVersion(program.id),
        links: await tx.listLinks({}),
        token: await tx.getLinkByTokenHash("new-hash"),
        clicks: await tx.countClicks(link.id),
        programClicks: await tx.countClicksForProgram(program.id),
        attributions: await tx.listAttributions({}),
        first: await tx.getFirstAttributionForRecipient("welcome", added.recipient),
        count: await tx.countSubjectReceipts("welcome", "q4", referrer, ["claimed"]),
        intents: await tx.listBenefitIntents({}),
        logical: await tx.getBenefitIntentByLogicalKey("new-logical"),
        budget: await tx.readBudgetReserved(program.id, 1),
        audits: await (tx instanceof InMemoryReferralStore ? tx : store).listAudits(),
      }),
      mutateCopies: async (tx) => {
        const loaded = await tx.getProgram(program.id, 1);
        loaded?.startsAt.setTime(0);
        if (loaded?.referrerBenefit.kind === "trial-credits")
          loaded.referrerBenefit.expiresAt?.setTime(0);
        const savedLink = await tx.getLink(link.id);
        savedLink?.expiresAt.setTime(0);
        if (savedLink) (savedLink.referrer as { id: string }).id = "changed";
        const saved = await tx.getAttribution(attribution.id);
        saved?.claimedAt.setTime(0);
        if (saved) (saved.scope as { tenantId: string }).tenantId = "changed";
        const savedIntent = await tx.getBenefitIntent(intent.id);
        if (savedIntent?.benefit.kind === "trial-credits")
          savedIntent.benefit.expiresAt?.setTime(0);
      },
    };
  },
);

describe("InMemoryReferralStore link identity", () => {
  it.each([false, true])(
    "rejects a different hash without changing a revoked=%s link",
    async (revoked) => {
      const store = new InMemoryReferralStore();
      await store.saveLink(link);
      if (revoked) await store.revokeLink(link.id, new Date("2026-10-02T00:00:00Z"));
      const before = await store.getLink(link.id);

      await expect(
        store.saveLink({ ...link, tokenHash: "replacement-hash" }),
      ).rejects.toBeInstanceOf(ReferralDuplicateClaimProblem);

      expect(await store.getLink(link.id)).toEqual(before);
      expect(await store.getLinkByTokenHash(link.tokenHash)).toEqual(before);
      expect(await store.getLinkByTokenHash("replacement-hash")).toBeNull();
    },
  );

  it("replays the stored link with the same hash without extending or restoring it", async () => {
    const store = new InMemoryReferralStore();
    expect(await store.saveLink(link)).toEqual({ created: true, link });
    const revoked = await store.revokeLink(link.id, new Date("2026-10-02T00:00:00Z"));

    const replay = await store.saveLink({ ...link, expiresAt: new Date("2028-01-01T00:00:00Z") });

    expect(replay).toEqual({ created: false, link: revoked });
    replay.link.expiresAt.setTime(0);
    expect(await store.getLinkByTokenHash(link.tokenHash)).toEqual(revoked);
  });
});

describe("InMemoryReferralStore service atomicity", () => {
  it("rejects a generated replacement token before recording link creation", async () => {
    const store = new InMemoryReferralStore();
    let nextToken = 0;
    const service = new ReferralService({
      store,
      clock: () => new Date(now),
      tokens: { generateToken: () => `token-${++nextToken}`, hashToken: hashReferralToken },
      fulfillment: {
        fulfill: async () => ({ outcome: "granted", grantRef: "grant" }),
        check: async () => null,
      },
    });
    await service.registerProgram(program);
    const input = { programId: program.id, referrer, linkId: "explicit-link", now };
    const created = await service.createReferralLink(input);
    expect(created.link.tokenHash).toBe(hashReferralToken(created.token));
    expect(await store.getLinkByTokenHash(hashReferralToken(created.token))).toEqual(created.link);
    const audits = await store.listAudits();

    await expect(service.createReferralLink(input)).rejects.toBeInstanceOf(
      ReferralDuplicateClaimProblem,
    );

    expect(await store.listAudits()).toEqual(audits);
    expect(await store.getLink(created.link.id)).toEqual(created.link);
    expect(await store.getLinkByTokenHash(hashReferralToken("token-2"))).toBeNull();
    const replay = await service.createReferralLink({ ...input, token: created.token });
    expect(replay).toEqual(created);
  });

  it("does not expose, recover or qualify an attribution whose budget reservation failed", async () => {
    const store = new InMemoryReferralStore();
    const service = new ReferralService({
      store,
      clock: () => new Date(now),
      tokens: { generateToken: () => "token", hashToken: hashReferralToken },
      novelty: () => ({ novelty: "new", reason: "new" }),
      qualification: () => ({
        qualified: true,
        sourceEventId: "event",
        qualifyingAction: "purchase",
        eligibleReason: "valid",
      }),
      fulfillment: {
        fulfill: async () => ({ outcome: "granted", grantRef: "grant" }),
        check: async () => null,
      },
    });
    await service.registerProgram({ ...program, budgetTotal: "15" });
    const shared = await service.createReferralLink({ programId: program.id, referrer, now });
    await service.claimAttribution({ token: shared.token, recipient, attributionId: "first", now });
    const before = await store.listAudits();
    const next = { ...recipient, id: "three" };
    await expect(
      service.claimAttribution({
        token: shared.token,
        recipient: next,
        attributionId: "failed",
        now,
      }),
    ).rejects.toThrow(ReferralBudgetExhaustedProblem);
    expect(await store.getAttribution("failed")).toBeNull();
    expect(await store.getFirstAttributionForRecipient("welcome", next)).toBeNull();
    expect(await store.listBenefitIntents({ attributionId: "failed" })).toEqual([]);
    expect(await store.listAudits()).toEqual(before);
    await expect(
      service.qualifyAttribution({ attributionId: "failed", recipient: next, now }),
    ).rejects.toThrow(ReferralAttributionNotFoundProblem);
    expect((await service.recoverPendingAttributions({})).map((entry) => entry.id)).not.toContain(
      "failed",
    );
    expect(await store.readBudgetReserved(program.id, 1)).toBe("15");
  });
});
