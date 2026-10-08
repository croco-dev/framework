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

export type MissionScope = { appId: string; environmentId: string; tenantId: string };
export type MissionDefinition = {
  id: string;
  version: number;
  actionId: string;
  countMode: "events" | "distinct-days" | "streak";
  unit: "event" | "day";
  timezone: string;
  period: "day" | "week";
  /** Local calendar date YYYY-MM-DD; weekly periods repeat every seven calendar days. */
  anchor: string;
  target: number;
  perPeriodCap: number;
  lateAcceptanceMs: number;
  closedCorrection: "reject" | "record-only" | "recalculate";
};
export type MissionPublication = {
  scope: MissionScope;
  definition: MissionDefinition;
  actorId: string;
  reason: string;
  revision: number;
  idempotencyKey: string;
  publishedAt: string;
};
export type MissionAggregateKey = {
  scope: MissionScope;
  subjectId: string;
  missionId: string;
  version: number;
  episodeId: string;
  periodKey: string;
};
export type MissionEvidence = {
  eventId: string;
  actionId: string;
  occurredAt: string;
  reversalOf?: string;
};
export type MissionEvidenceReceipt = MissionEvidence & {
  acceptedAt: string;
  periodKey: string;
  activityDate: string;
  effect: "counted" | "record-only";
};
export type MissionCompletion = {
  id: string;
  periodKey: string;
  achievedAt: string;
  eventId: string;
};
export type MissionInstance = {
  periodKey: string;
  startDate: string;
  endDate: string;
  progress: number;
  state: "active" | "achieved" | "closed";
  activityDates: string[];
  closedAt?: string;
  completion?: MissionCompletion;
};
export type MissionAggregate = {
  key: MissionAggregateKey;
  definition: MissionDefinition;
  instances: Record<string, MissionInstance>;
  receipts: Record<string, MissionEvidenceReceipt>;
  completions: Record<string, MissionCompletion>;
};
export interface MissionStore {
  /** Serialize per key and atomically persist aggregate, receipts and unique completions. Roll back thrown operations. */
  transaction<T>(
    key: MissionAggregateKey,
    operation: (current: MissionAggregate | undefined) => {
      aggregate: MissionAggregate;
      result: T;
    },
  ): Promise<T>;
  read(key: MissionAggregateKey): Promise<MissionAggregate | undefined>;
  /** Immutable versions; matching idempotency replays, conflicting payload/revision rejects. */
  publish(publication: MissionPublication): Promise<MissionPublication>;
  getDefinition(
    scope: MissionScope,
    missionId: string,
    version: number,
  ): Promise<MissionPublication | undefined>;
}
export type MissionActor = { id: string };
export type MissionAccessRequest = {
  actor: MissionActor;
  scope: MissionScope;
  subjectId?: string;
  operation: "read" | "write" | "publish";
};
export interface MissionAuthorization {
  authorize(request: MissionAccessRequest): Promise<boolean>;
}
export interface MissionEvidenceVerifier {
  verify(input: {
    key: MissionAggregateKey;
    actor: MissionActor;
    evidence: MissionEvidence;
  }): Promise<boolean>;
}
export type MissionCommand = { actor: MissionActor; key: MissionAggregateKey };
export type MissionProgress = {
  key: MissionAggregateKey;
  definition: MissionDefinition;
  instance: MissionInstance;
  remaining: number;
};
export type MissionIngestResult = {
  progress: MissionProgress;
  receipt: MissionEvidenceReceipt;
  duplicate: boolean;
  completionCreated: boolean;
};
export type MissionServiceOptions = {
  store: MissionStore;
  authorization: MissionAuthorization;
  verifier: MissionEvidenceVerifier;
  clock?: () => Date;
};
