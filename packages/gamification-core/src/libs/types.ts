export type RewardScope = {
  readonly appId: string;
  readonly environmentId: string;
  readonly tenantId: string;
};
export type RewardEntry =
  | {
      readonly id: string;
      readonly kind: "points";
      readonly unit: "achievement-point";
      readonly amount: number;
      readonly title: string;
    }
  | {
      readonly id: string;
      readonly kind: "badge";
      readonly badgeId: string;
      readonly title: string;
    };
export type RewardFallback =
  | { readonly kind: "no-reward" }
  | { readonly kind: "fixed"; readonly entry: RewardEntry; readonly cap: number };
export type RewardPolicy = {
  readonly id: string;
  readonly version: string;
  readonly title: string;
  readonly mode: "fixed" | "weighted";
  readonly weightedEnabled?: boolean;
  readonly rewardEntries: readonly RewardEntry[];
  readonly weights?: readonly number[];
  readonly budgetUnit: "achievement-grant";
  readonly cap: number;
  readonly fallback: RewardFallback;
  readonly effectiveFrom: string;
  readonly effectiveUntil: string;
};
export type RewardPublication = {
  readonly scope: RewardScope;
  readonly policy: RewardPolicy;
  readonly expectedRevision: number;
  readonly actorId: string;
  readonly reason: string;
  readonly idempotencyKey: string;
};
export type PublishedRewardPolicy = RewardPublication & { readonly revision: number };
export type RewardKey = {
  readonly scope: RewardScope;
  readonly policyId: string;
  readonly policyVersion: string;
  readonly subject: string;
  readonly evidenceRef: string;
};
export type RewardSelection = {
  readonly entry: RewardEntry | null;
  readonly receipt: {
    readonly policyVersion: string;
    readonly revision: number;
    readonly mode: RewardPolicy["mode"];
    readonly weights: readonly number[];
    readonly bucket: number | null;
    readonly fallback: boolean;
    readonly fallbackPolicy: RewardFallback;
  };
};
export type RewardGrant = RewardKey & {
  readonly id: string;
  readonly selection: RewardSelection;
  readonly state: "reserved" | "granted" | "rejected" | "indeterminate";
  readonly rejection: "no-reward" | "badge-owned" | null;
  readonly createdAt: string;
};
export type PointEntry = {
  readonly grantId: string;
  readonly unit: "achievement-point";
  readonly amount: number;
  readonly createdAt: string;
};
export type BadgeOwnership = {
  readonly badgeId: string;
  readonly title: string;
  readonly grantId: string;
  readonly createdAt: string;
};
export type RewardAccount = {
  readonly points: readonly PointEntry[];
  readonly badges: readonly BadgeOwnership[];
  readonly grants: readonly RewardGrant[];
};
export interface RewardEvidenceVerifier {
  verify(key: RewardKey): Promise<boolean>;
}
export interface RewardAccessVerifier {
  authorizeSubject(scope: RewardScope, subject: string): Promise<boolean>;
  authorizePublication(publication: RewardPublication): Promise<boolean>;
}
