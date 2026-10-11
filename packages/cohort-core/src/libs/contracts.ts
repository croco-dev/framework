export type CohortScope = Readonly<{ appId: string; environment: string; tenantId: string }>;
export type CohortResult = "match" | "no_match" | "unknown";
export type CohortOperator = "eq" | "ne" | "gt" | "gte" | "lt" | "lte";
export type CohortScalar = string | number | boolean;
export type CohortPredicate =
  | Readonly<{ kind: "all" | "any"; children: readonly CohortPredicate[] }>
  | Readonly<{ kind: "not"; child: CohortPredicate }>
  | Readonly<{ kind: "fact"; field: string; operator: CohortOperator; value: CohortScalar }>
  | Readonly<{
      kind: "event";
      event: string;
      metric: "count" | "distinct-calendar-days";
      operator: CohortOperator;
      value: number;
      windowDays: number;
    }>
  | Readonly<{ kind: "static"; membershipId: string }>;
export type CohortDefinition = Readonly<{
  id: string;
  version: number;
  subjectKind: string;
  scope: CohortScope;
  root: CohortPredicate;
}>;
export type CohortFieldRegistration = Readonly<{
  type: "string" | "number" | "boolean";
  operators: readonly CohortOperator[];
  values?: readonly CohortScalar[];
}>;
export type CohortRegistration = Readonly<{
  fields: Readonly<Record<string, CohortFieldRegistration>>;
  events: readonly string[];
  memberships: readonly string[];
}>;
export type CohortLimits = Readonly<{
  nesting: number;
  predicates: number;
  sample: number;
  rows: number;
  cost: number;
}>;
export type CohortValidationContext = Readonly<{
  scope: CohortScope;
  subjectKind: string;
  allowedFields: readonly string[];
  limits?: Partial<CohortLimits>;
}>;
export type CohortSubject = Readonly<{
  subjectId: string;
  facts: Readonly<Record<string, CohortScalar | null>>;
  events: readonly Readonly<{ event: string; occurredAt: string }>[];
  coverage: readonly Readonly<{ event: string; from: string; to: string }>[];
  memberships: readonly string[];
}>;
export type CohortExplanation = Readonly<{
  kind: CohortPredicate["kind"];
  result: CohortResult;
  reason: string;
  children?: readonly CohortExplanation[];
}>;
export type CohortMember = Readonly<{
  subjectId: string;
  result: CohortResult;
  explanation: CohortExplanation;
}>;
export type CohortRun = Readonly<{
  id: string;
  definitionVersion: number;
  asOf: string;
  sourceSnapshotRefs: readonly string[];
  sourceWatermarks: Readonly<Record<string, string>>;
  status: "queued" | "running" | "complete" | "failed" | "canceled";
}>;
export type CohortSnapshot = Readonly<{
  snapshotId: string;
  scope: CohortScope;
  subjectKind: string;
  definitionId: string;
  definitionVersion: number;
  schemaVersion: 1;
  sourceSnapshotRefs: readonly string[];
  asOf: string;
  generatedAt: string;
  validUntil: string;
  contentHash: string;
  publicationRevision: number;
  privacyVersion: string;
  membershipRef: string;
}>;
export type CohortPublication = Readonly<{
  snapshot: CohortSnapshot;
  subjectIds: readonly string[];
  withdrawn: boolean;
}>;
export interface CohortPublicationStore {
  read(snapshotId: string): Promise<CohortPublication | undefined>;
}
export interface CohortPrivacyReader {
  currentVersion(scope: CohortScope): Promise<string>;
  isAllowed(scope: CohortScope, subjectId: string): Promise<boolean>;
}
