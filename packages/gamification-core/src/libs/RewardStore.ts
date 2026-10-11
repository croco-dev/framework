import type {
  PublishedRewardPolicy,
  RewardAccount,
  RewardGrant,
  RewardKey,
  RewardPublication,
  RewardScope,
  RewardSelection,
} from "./types";

export abstract class RewardStore {
  abstract publish(publication: RewardPublication): Promise<PublishedRewardPolicy>;
  abstract getPolicy(scope: RewardScope, policyId: string): Promise<PublishedRewardPolicy | null>;
  /** Serialize the family cap and logical key; invoke select only for a new, eligible grant. */
  abstract reserve(
    key: RewardKey,
    select: (publication: PublishedRewardPolicy, depleted: boolean) => RewardSelection,
  ): Promise<RewardGrant>;
  /** Atomically append the point entry or unique badge ownership and settle the persisted selection. */
  abstract settle(key: RewardKey): Promise<RewardGrant>;
  abstract getAccount(scope: RewardScope, subject: string): Promise<RewardAccount>;
}
