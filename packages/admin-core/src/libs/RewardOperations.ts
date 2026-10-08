import {
  RewardAccessDeniedProblem,
  InvalidRewardPolicyProblem,
  assertRewardScope,
} from "@croco/gamification-core/reward-contracts";
import type {
  RewardService,
  RewardScope,
  RewardPublication,
  RewardKey,
} from "@croco/gamification-core";

export type RewardAdminAccess = {
  readonly scope: RewardScope;
  readonly actorId: string;
  readonly permissions: readonly ("reward.read" | "reward.publish" | "reward.test")[];
};

/** Access is resolved from the authenticated server session. */
export class RewardOperations {
  constructor(private readonly service: RewardService) {}

  private authorize(
    scope: RewardScope,
    access: RewardAdminAccess,
    permission: RewardAdminAccess["permissions"][number],
  ): void {
    assertRewardScope(scope);
    assertRewardScope(access.scope);
    if (
      typeof access.actorId !== "string" ||
      !access.actorId.trim() ||
      !access.permissions.includes(permission) ||
      scope.appId !== access.scope.appId ||
      scope.environmentId !== access.scope.environmentId ||
      scope.tenantId !== access.scope.tenantId
    ) {
      throw new RewardAccessDeniedProblem();
    }
  }

  publish(input: RewardPublication, access: RewardAdminAccess) {
    this.authorize(input.scope, access, "reward.publish");
    if (input.actorId !== access.actorId) throw new RewardAccessDeniedProblem();
    if (
      typeof input.reason !== "string" ||
      !input.reason.trim() ||
      typeof input.idempotencyKey !== "string" ||
      !input.idempotencyKey.trim() ||
      !Number.isSafeInteger(input.expectedRevision) ||
      input.expectedRevision < 0
    ) {
      throw new InvalidRewardPolicyProblem(
        "Publication requires reason, idempotency key, and expected revision.",
      );
    }
    return this.service.publish(input);
  }

  getPolicy(policyId: string, subject: string, access: RewardAdminAccess) {
    this.authorize(access.scope, access, "reward.read");
    return this.service.getPolicy(access.scope, policyId, subject);
  }

  getAccount(subject: string, access: RewardAdminAccess) {
    this.authorize(access.scope, access, "reward.read");
    return this.service.getAccount(access.scope, subject);
  }

  testGrant(key: RewardKey, access: RewardAdminAccess) {
    this.authorize(key.scope, access, "reward.test");
    if (key.scope.environmentId !== "test") throw new RewardAccessDeniedProblem();
    return this.service.grantForEvidence(key);
  }
}
