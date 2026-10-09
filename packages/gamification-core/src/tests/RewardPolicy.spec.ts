import { describe, expect, it, vi } from "vitest";
import {
  assertRewardPolicy,
  InvalidRewardPolicyProblem,
  RewardAccessDeniedProblem,
  RewardEvidenceInvalidProblem,
  RewardService,
  selectReward,
} from "../index";
import type {
  PublishedRewardPolicy,
  RewardGrant,
  RewardKey,
  RewardPolicy,
  RewardSelection,
  RewardStore,
} from "../index";

const policy: RewardPolicy = {
  id: "first-report",
  version: "v1",
  title: "Report achievement",
  mode: "weighted",
  weightedEnabled: true,
  rewardEntries: [
    {
      id: "point",
      title: "10 achievement points",
      kind: "points",
      unit: "achievement-point",
      amount: 10,
    },
    { id: "badge", title: "Reporter badge", kind: "badge", badgeId: "reporter" },
  ],
  weights: [1, 3],
  budgetUnit: "achievement-grant",
  cap: 100,
  fallback: { kind: "no-reward" },
  effectiveFrom: "2026-01-01T00:00:00Z",
  effectiveUntil: "2027-01-01T00:00:00Z",
};
const publication: PublishedRewardPolicy = {
  scope: { appId: "reports", environmentId: "test", tenantId: "acme" },
  policy,
  expectedRevision: 0,
  revision: 1,
  actorId: "operator",
  reason: "Achievement",
  idempotencyKey: "publish-v1",
};
const key: RewardKey = {
  scope: publication.scope,
  policyId: policy.id,
  policyVersion: policy.version,
  subject: "alice",
  evidenceRef: "report-1",
};

describe("Reward policy selection", () => {
  it.each([
    [0, 0],
    [0.249999999, 0],
    [0.25, 1],
    [0.999999999, 1],
  ])("maps 1:3 draw %s to bucket %s", (draw, bucket) => {
    const selected = selectReward(publication, false, () => draw);
    expect(selected.receipt.bucket).toBe(bucket);
    expect(selected.entry).toEqual(policy.rewardEntries[bucket]);
    expect(selected.receipt.weights).toEqual([1, 3]);
    expect(selected.receipt.revision).toBe(1);
  });
  it.each([
    [-1, 3],
    [NaN, 3],
    [0, 0],
    [1.1, 3],
    [Infinity, 3],
    [Number.MAX_SAFE_INTEGER, 1],
  ])("rejects invalid weights %s", (a, b) => {
    expect(() => assertRewardPolicy({ ...policy, weights: [a, b] })).toThrow(
      InvalidRewardPolicyProblem,
    );
  });
  it("requires explicit weighted enablement and matching entry weights", () => {
    expect(() => assertRewardPolicy({ ...policy, weightedEnabled: false })).toThrow(
      InvalidRewardPolicyProblem,
    );
    expect(() => assertRewardPolicy({ ...policy, weights: [1] })).toThrow(
      InvalidRewardPolicyProblem,
    );
    expect(() => assertRewardPolicy({ ...policy, mode: "fixed" })).toThrow(
      InvalidRewardPolicyProblem,
    );
  });
  it("skips zero buckets without renormalizing depleted rewards", () => {
    expect(
      selectReward({ ...publication, policy: { ...policy, weights: [0, 3] } }, false, () => 0)
        .receipt.bucket,
    ).toBe(1);
    const random = vi.fn(() => 0);
    expect(selectReward(publication, true, random).entry).toBeNull();
    expect(random).not.toHaveBeenCalled();
  });
  it("pins published fixed fallback and never draws for it", () => {
    const fallback = { kind: "fixed", entry: policy.rewardEntries[0], cap: 2 } as const;
    const random = vi.fn(() => 0.99);
    const result = selectReward({ ...publication, policy: { ...policy, fallback } }, true, random);
    expect(result.entry).toEqual(fallback.entry);
    expect(result.receipt).toMatchObject({
      fallback: true,
      fallbackPolicy: fallback,
      bucket: null,
    });
    expect(random).not.toHaveBeenCalled();
  });
  it.each([-1, 1, NaN, Infinity])("rejects invalid server random %s", (draw) => {
    expect(() => selectReward(publication, false, () => draw)).toThrow(InvalidRewardPolicyProblem);
  });
  it("rejects credit units, invalid points, caps and windows", () => {
    for (const amount of [-1, 0, NaN, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() =>
        assertRewardPolicy({
          ...policy,
          rewardEntries: [
            { id: "a", title: "a", kind: "points", unit: "achievement-point", amount },
          ],
          weights: [1],
        }),
      ).toThrow(InvalidRewardPolicyProblem);
    }
    expect(() =>
      assertRewardPolicy({ ...policy, budgetUnit: "credit" } as unknown as RewardPolicy),
    ).toThrow(InvalidRewardPolicyProblem);
    expect(() =>
      assertRewardPolicy({
        ...policy,
        rewardEntries: [{ id: "a", title: "a", kind: "points", unit: "credit", amount: 10 }],
        weights: [1],
      } as unknown as RewardPolicy),
    ).toThrow(InvalidRewardPolicyProblem);
    expect(() => assertRewardPolicy({ ...policy, cap: -1 })).toThrow(InvalidRewardPolicyProblem);
    expect(() => assertRewardPolicy({ ...policy, effectiveUntil: policy.effectiveFrom })).toThrow(
      InvalidRewardPolicyProblem,
    );
  });
});

describe("RewardService server boundaries", () => {
  function setup() {
    let selected: RewardGrant | undefined;
    const store: RewardStore = {
      publish: vi.fn(async () => publication),
      getPolicy: vi.fn(async () => publication),
      getAccount: vi.fn(async () => ({
        points: [],
        badges: [],
        grants: selected ? [selected] : [],
      })),
      reserve: vi.fn(
        async (
          request: RewardKey,
          select: (publication: PublishedRewardPolicy, depleted: boolean) => RewardSelection,
        ): Promise<RewardGrant> => {
          if (!selected)
            selected = {
              ...request,
              id: "grant-1",
              selection: select(publication, false),
              state: "reserved",
              rejection: null,
              createdAt: "2026-10-08T00:00:00Z",
            };
          return selected;
        },
      ),
      settle: vi.fn(async () => {
        if (!selected) throw new RewardEvidenceInvalidProblem();
        selected = { ...selected, state: "granted" };
        return selected;
      }),
    };
    const evidence = { verify: vi.fn(async () => true) };
    const access = {
      authorizeSubject: vi.fn(async () => true),
      authorizePublication: vi.fn(async () => true),
    };
    const random = vi.fn(() => 0.1);
    const service = new RewardService(store, evidence, access, random);
    return { service, store, evidence, access, random };
  }
  it("retries the same receipt after a settlement failure without a second draw", async () => {
    const { service, store, random } = setup();
    vi.mocked(store.settle).mockRejectedValueOnce(new RewardEvidenceInvalidProblem());
    await expect(service.grantForEvidence(key)).rejects.toThrow(RewardEvidenceInvalidProblem);
    const result = await service.grantForEvidence({ ...key, policyVersion: "v2" });
    expect(result.policyVersion).toBe("v1");
    expect(result.selection.receipt.bucket).toBe(0);
    expect(random).toHaveBeenCalledTimes(1);
  });
  it("rejects missing tenant and denied subject before touching evidence/store", async () => {
    const { service, store, evidence, access } = setup();
    await expect(
      service.grantForEvidence({ ...key, scope: { ...key.scope, tenantId: "" } }),
    ).rejects.toThrow(RewardAccessDeniedProblem);
    access.authorizeSubject.mockResolvedValue(false);
    await expect(service.grantForEvidence(key)).rejects.toThrow(RewardAccessDeniedProblem);
    await expect(service.getAccount(key.scope, "mallory")).rejects.toThrow(
      RewardAccessDeniedProblem,
    );
    expect(evidence.verify).not.toHaveBeenCalled();
    expect(store.reserve).not.toHaveBeenCalled();
  });
  it("rejects unconfirmed and foreign evidence without reserving or drawing", async () => {
    const { service, evidence, store, random } = setup();
    evidence.verify.mockResolvedValue(false);
    await expect(service.grantForEvidence(key)).rejects.toThrow(RewardEvidenceInvalidProblem);
    expect(store.reserve).not.toHaveBeenCalled();
    expect(random).not.toHaveBeenCalled();
  });
  it("requires audited and authorized policy publication", async () => {
    const { service, access, store } = setup();
    await expect(service.publish({ ...publication, reason: "" })).rejects.toThrow(
      RewardAccessDeniedProblem,
    );
    access.authorizePublication.mockResolvedValue(false);
    await expect(service.publish(publication)).rejects.toThrow(RewardAccessDeniedProblem);
    expect(store.publish).not.toHaveBeenCalled();
  });
});
