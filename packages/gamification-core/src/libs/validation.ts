import { validRewardId } from "./validRewardId";
import { InvalidRewardPolicyProblem, RewardAccessDeniedProblem } from "./problems";
import type {
  PublishedRewardPolicy,
  RewardEntry,
  RewardPolicy,
  RewardScope,
  RewardSelection,
} from "./types";

export function assertRewardScope(scope: RewardScope): void {
  if (!scope || ![scope.appId, scope.environmentId, scope.tenantId].every(validRewardId)) {
    throw new RewardAccessDeniedProblem();
  }
}

function assertEntry(entry: RewardEntry): void {
  if (!entry || !validRewardId(entry.id) || !validRewardId(entry.title)) {
    throw new InvalidRewardPolicyProblem("Reward entry identity and title are required.");
  }
  if (entry.kind === "points") {
    if (
      entry.unit !== "achievement-point" ||
      !Number.isSafeInteger(entry.amount) ||
      entry.amount <= 0
    ) {
      throw new InvalidRewardPolicyProblem(
        "Points require a positive safe integer in achievement-point units.",
      );
    }
  } else if (entry.kind !== "badge" || !validRewardId(entry.badgeId)) {
    throw new InvalidRewardPolicyProblem(
      "Only non-transferable achievement points and badges are supported.",
    );
  }
}

export function assertRewardPolicy(policy: RewardPolicy): void {
  if (!policy || ![policy.id, policy.version, policy.title].every(validRewardId)) {
    throw new InvalidRewardPolicyProblem("Policy identity, version, and title are required.");
  }
  if (
    policy.budgetUnit !== "achievement-grant" ||
    !Number.isSafeInteger(policy.cap) ||
    policy.cap < 0
  ) {
    throw new InvalidRewardPolicyProblem(
      "Cap must be a non-negative safe integer in achievement-grant units.",
    );
  }
  const from = Date.parse(policy.effectiveFrom);
  const until = Date.parse(policy.effectiveUntil);
  if (!Number.isFinite(from) || !Number.isFinite(until) || until <= from) {
    throw new InvalidRewardPolicyProblem("Policy requires an ordered finite effectiveness window.");
  }
  if (
    !Array.isArray(policy.rewardEntries) ||
    policy.rewardEntries.length === 0 ||
    policy.rewardEntries.length > 100
  ) {
    throw new InvalidRewardPolicyProblem("Policy requires between 1 and 100 reward entries.");
  }
  policy.rewardEntries.forEach(assertEntry);
  if (new Set(policy.rewardEntries.map((entry) => entry.id)).size !== policy.rewardEntries.length) {
    throw new InvalidRewardPolicyProblem("Reward entry identities must be unique.");
  }
  if (policy.mode === "fixed") {
    if (
      policy.rewardEntries.length !== 1 ||
      policy.weights !== undefined ||
      policy.weightedEnabled === true
    ) {
      throw new InvalidRewardPolicyProblem(
        "Fixed policies require exactly one entry and no weights.",
      );
    }
  } else if (policy.mode === "weighted") {
    if (
      policy.weightedEnabled !== true ||
      !Array.isArray(policy.weights) ||
      policy.weights.length !== policy.rewardEntries.length
    ) {
      throw new InvalidRewardPolicyProblem(
        "Weighted rewards require explicit activation and one weight per entry.",
      );
    }
    let sum = 0;
    for (const weight of policy.weights) {
      if (!Number.isSafeInteger(weight) || weight < 0)
        throw new InvalidRewardPolicyProblem("Weights must be non-negative safe integers.");
      sum += weight;
      if (!Number.isSafeInteger(sum))
        throw new InvalidRewardPolicyProblem("Weight total exceeds the safe integer range.");
    }
    if (sum === 0) throw new InvalidRewardPolicyProblem("Weight total must be positive.");
  } else {
    throw new InvalidRewardPolicyProblem("Unsupported reward mode.");
  }
  if (!policy.fallback || !["no-reward", "fixed"].includes(policy.fallback.kind)) {
    throw new InvalidRewardPolicyProblem("Publish an explicit depletion fallback.");
  }
  if (policy.fallback.kind === "fixed") {
    assertEntry(policy.fallback.entry);
    if (!Number.isSafeInteger(policy.fallback.cap) || policy.fallback.cap < 0) {
      throw new InvalidRewardPolicyProblem("Fixed fallback requires its own bounded grant cap.");
    }
  }
}

export function selectReward(
  publication: PublishedRewardPolicy,
  depleted: boolean,
  random: () => number,
): RewardSelection {
  const policy = publication.policy;
  assertRewardPolicy(policy);
  let bucket: number | null = null;
  let entry: RewardEntry | null;
  if (depleted) {
    entry = policy.fallback.kind === "fixed" ? policy.fallback.entry : null;
  } else if (policy.mode === "fixed") {
    entry = policy.rewardEntries[0];
  } else {
    const weights = policy.weights;
    if (!weights) throw new InvalidRewardPolicyProblem("Weighted policy has no weights.");
    const draw = random();
    if (!Number.isFinite(draw) || draw < 0 || draw >= 1)
      throw new InvalidRewardPolicyProblem("Server RNG must return a finite value in [0, 1).");
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    const target = draw * total;
    let boundary = 0;
    bucket = weights.findIndex((weight) => {
      boundary += weight;
      return target < boundary;
    });
    if (bucket < 0)
      throw new InvalidRewardPolicyProblem("Server RNG did not select a reward bucket.");
    entry = policy.rewardEntries[bucket];
  }
  return {
    entry,
    receipt: {
      policyVersion: policy.version,
      revision: publication.revision,
      mode: policy.mode,
      weights: [...(policy.weights ?? [])],
      bucket,
      fallback: depleted,
      fallbackPolicy: policy.fallback,
    },
  };
}
