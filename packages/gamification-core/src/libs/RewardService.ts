import {
  RewardAccessDeniedProblem,
  RewardEvidenceInvalidProblem,
  assertRewardPolicy,
  assertRewardScope,
  selectReward,
} from "@croco/gamification-core/reward-contracts";
import { validRewardId } from "./validRewardId";
import type { RewardStore } from "./RewardStore";
import type {
  PublishedRewardPolicy,
  RewardAccessVerifier,
  RewardAccount,
  RewardEvidenceVerifier,
  RewardGrant,
  RewardKey,
  RewardPublication,
  RewardScope,
} from "./types";

export class RewardService {
  constructor(
    private readonly store: RewardStore,
    private readonly evidence: RewardEvidenceVerifier,
    private readonly access: RewardAccessVerifier,
    private readonly random: () => number = Math.random,
  ) {}

  async publish(publication: RewardPublication): Promise<PublishedRewardPolicy> {
    assertRewardScope(publication.scope);
    assertRewardPolicy(publication.policy);
    if (
      ![publication.actorId, publication.reason, publication.idempotencyKey].every(validRewardId) ||
      !Number.isSafeInteger(publication.expectedRevision) ||
      publication.expectedRevision < 0
    ) {
      throw new RewardAccessDeniedProblem();
    }
    if (!(await this.access.authorizePublication(publication)))
      throw new RewardAccessDeniedProblem();
    return this.store.publish(publication);
  }

  async grantForEvidence(key: RewardKey): Promise<RewardGrant> {
    await this.authorize(key.scope, key.subject);
    if (
      ![key.policyId, key.policyVersion, key.evidenceRef].every(validRewardId) ||
      !(await this.evidence.verify(key))
    ) {
      throw new RewardEvidenceInvalidProblem();
    }
    await this.store.reserve(key, (publication, depleted) =>
      selectReward(publication, depleted, this.random),
    );
    return this.store.settle(key);
  }

  async getAccount(scope: RewardScope, subject: string): Promise<RewardAccount> {
    await this.authorize(scope, subject);
    return this.store.getAccount(scope, subject);
  }

  async getPolicy(
    scope: RewardScope,
    policyId: string,
    subject: string,
  ): Promise<PublishedRewardPolicy | null> {
    await this.authorize(scope, subject);
    if (!validRewardId(policyId)) throw new RewardAccessDeniedProblem();
    return this.store.getPolicy(scope, policyId);
  }

  private async authorize(scope: RewardScope, subject: string): Promise<void> {
    assertRewardScope(scope);
    if (!validRewardId(subject) || !(await this.access.authorizeSubject(scope, subject)))
      throw new RewardAccessDeniedProblem();
  }
}
