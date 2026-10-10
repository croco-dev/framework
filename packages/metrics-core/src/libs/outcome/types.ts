export type OutcomeScope = { app: string; environment: string; tenant: string };
export type OutcomeCutoff = { effectiveAt: string; knownAt: string };
export type OutcomeReference = { source: string; eventId: string };
export type OutcomeKind =
  | "payment"
  | "refund"
  | "cashback"
  | "direct_contact_cost"
  | "noncash_grant";
export type MoneyEvent = {
  scope: OutcomeScope;
  source: string;
  eventId: string;
  subject: string | null;
  kind: OutcomeKind;
  amountMinor: string;
  currency: string;
  occurredAt: string;
  observedAt: string;
  relatedPaymentId?: string;
  valuationKind: "cash" | "face_value";
  correctionOf?: OutcomeReference;
};
export type AssignmentSnapshot = {
  id: string;
  scope: OutcomeScope;
  unit: string;
  arms: readonly string[];
  assignments: readonly { subject: string; arm: string }[];
};
export type OutcomeCostCompleteness = {
  arm: string;
  source: string;
  kind: OutcomeKind;
  currency: string;
  status: "complete" | "missing" | "pending";
  pendingCount?: number;
};
export type OutcomeRational = { numerator: string; denominator: string };
export type OutcomeDiagnostic = {
  code:
    | "missing_subject"
    | "unassigned_event"
    | "orphan_refund"
    | "zero_denominator"
    | "incomplete_cost"
    | "unknown_retention"
    | "incomplete_source";
  source?: string;
  eventId?: string;
  arm?: string;
  currency?: string;
};
export type AssignedOutcomeInput = {
  assignmentSnapshot: AssignmentSnapshot;
  events: readonly MoneyEvent[];
  cutoff: OutcomeCutoff;
  revision: string;
  metricDefinitionVersion: string;
  inputHash: string;
  definitionHash: string;
  currencies: readonly string[];
  sources: readonly string[];
  costCompleteness: readonly OutcomeCostCompleteness[];
  baselineArm: string;
  retention?: readonly { subject: string; retained: boolean | null }[];
  maxEvents?: number;
  maxAssignments?: number;
};
export type AssignedOutcomeArm = {
  arm: string;
  assignedUnits: number;
  components: Record<OutcomeKind, string>;
  netMinor: string;
  complete: boolean;
  perUnit: OutcomeRational | null;
  refundRate: OutcomeRational | null;
  refundRateDenominator: "paying_assigned_subjects";
  retentionRate: OutcomeRational | null;
  retentionRateDenominator: "assigned_units";
};
export type AssignedOutcomeReport = {
  sources: readonly string[];
  assignmentSnapshot: AssignmentSnapshot;
  cutoff: OutcomeCutoff;
  revision: string;
  metricDefinitionVersion: string;
  inputHash: string;
  definitionHash: string;
  costCompleteness: readonly OutcomeCostCompleteness[];
  byCurrency: {
    currency: string;
    arms: AssignedOutcomeArm[];
    delta: { arm: string; baselineArm: string; value: OutcomeRational | null }[];
  }[];
  diagnostics: OutcomeDiagnostic[];
  counts: {
    received: number;
    duplicates: number;
    excludedByCutoff: number;
    superseded: number;
    accepted: number;
    rejected: number;
  };
  quality: "complete" | "partial";
};
