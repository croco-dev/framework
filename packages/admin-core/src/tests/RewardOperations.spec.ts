import { describe, expect, it, vi } from "vitest";
import {
  RewardService,
  RewardAccessDeniedProblem,
  InvalidRewardPolicyProblem,
} from "@croco/gamification-core";
import type { RewardStore, RewardPublication } from "@croco/gamification-core";
import { RewardOperations } from "../libs/RewardOperations";
import type { RewardAdminAccess } from "../libs/RewardOperations";

describe("RewardOperations", () => {
  const scope = { appId: "app", tenantId: "tenant", environmentId: "test" };
  const access: RewardAdminAccess = {
    scope,
    actorId: "operator",
    permissions: ["reward.publish", "reward.test"],
  };
  const input: RewardPublication = {
    scope,
    actorId: "operator",
    reason: "Approved",
    idempotencyKey: "publish-v1",
    expectedRevision: 0,
    policy: {
      id: "p",
      version: "v1",
      title: "Policy",
      mode: "fixed",
      rewardEntries: [
        { id: "points", kind: "points", title: "Points", amount: 1, unit: "achievement-point" },
      ],
      budgetUnit: "achievement-grant",
      cap: 1,
      fallback: { kind: "no-reward" },
      effectiveFrom: "2026-01-01T00:00:00Z",
      effectiveUntil: "2099-01-01T00:00:00Z",
    },
  };
  function setup() {
    const publish = vi.fn(async (value: RewardPublication) => ({ ...value, revision: 1 }));
    const store = { publish } as unknown as RewardStore;
    return {
      publish,
      operations: new RewardOperations(
        new RewardService(
          store,
          { verify: async () => true },
          { authorizeSubject: async () => true, authorizePublication: async () => true },
        ),
      ),
    };
  }
  it("publishes through the same service and preserves audit metadata", async () => {
    const { publish, operations } = setup();
    await operations.publish(input, access);
    expect(publish).toHaveBeenCalledWith(input);
  });
  it("rejects actor substitution and cross-scope writes before persistence", () => {
    const { publish, operations } = setup();
    expect(() => operations.publish({ ...input, actorId: "other" }, access)).toThrow(
      RewardAccessDeniedProblem,
    );
    expect(() =>
      operations.publish({ ...input, scope: { ...scope, tenantId: "other" } }, access),
    ).toThrow(RewardAccessDeniedProblem);
    expect(publish).not.toHaveBeenCalled();
  });
  it("rejects malformed publication metadata with stable problems", () => {
    const { operations } = setup();
    expect(() =>
      operations.publish({ ...input, scope: undefined } as unknown as RewardPublication, access),
    ).toThrow(RewardAccessDeniedProblem);
    expect(() =>
      operations.publish({ ...input, reason: undefined } as unknown as RewardPublication, access),
    ).toThrow(InvalidRewardPolicyProblem);
    expect(() =>
      operations.publish(
        { ...input, idempotencyKey: undefined } as unknown as RewardPublication,
        access,
      ),
    ).toThrow(InvalidRewardPolicyProblem);
  });
  it("forbids test grants against production even with permission", () => {
    const { operations } = setup();
    const production = { ...scope, environmentId: "production" };
    expect(() =>
      operations.testGrant(
        {
          scope: production,
          subject: "member",
          evidenceRef: "e",
          policyId: "p",
          policyVersion: "v1",
        },
        { ...access, scope: production },
      ),
    ).toThrow(RewardAccessDeniedProblem);
  });
});
