/** Explicit tenant scope. Omission never grants cross-tenant access. */
export type EnrichmentScope = {
  readonly app: string;
  readonly environment: string;
  readonly tenant: string;
};
export type EnrichmentUsage =
  | {
      readonly kind: "known" | "estimated";
      readonly inputTokens: number;
      readonly outputTokens: number;
    }
  | { readonly kind: "unknown" };
export type ClassificationLabel = { readonly id: string; readonly label: string };
export type ClassificationDefinition = {
  readonly id: string;
  readonly version: string;
  readonly labels: readonly ClassificationLabel[];
  readonly schema: "label-id/v1";
  readonly normalization: { readonly version: string; readonly form: "nfkc-trim-lowercase" };
  readonly referenceCatalog: readonly { readonly text: string; readonly labelId: string }[];
  readonly modelPolicy?: {
    readonly modelRef: string;
    readonly promptVersion: string;
    readonly instructions: string;
  };
};
export type EnrichmentInput = {
  readonly itemId: string;
  readonly inputRevision: string;
  readonly text: string;
  readonly sourceRef: string;
  readonly context: Readonly<Record<string, string>>;
};
export type ClassificationLimits = {
  readonly maxInputBytes: number;
  readonly maxOutputBytes: number;
  readonly maxOutputTokens: number;
  readonly timeoutMs: number;
  readonly maxConcurrency: number;
  readonly maxAttempts: number;
  readonly maxRequests: number;
  readonly maxReservedTokens: number;
  /** Conservative provider-specific upper estimate, including schema/instructions overhead. */
  readonly tokensPerRequest: number;
};
export type ClassifyText = (request: {
  readonly text: string;
  readonly context: Readonly<Record<string, string>>;
  readonly allowedLabels: readonly ClassificationLabel[];
  readonly instructions: string;
  readonly modelRef: string;
  readonly signal: AbortSignal;
  readonly limits: ClassificationLimits;
}) => Promise<{
  readonly json: string;
  readonly completion: "complete" | "truncated" | "refused" | "failed";
  readonly usage: EnrichmentUsage;
  readonly modelRef: string;
  readonly providerRequestRef?: string;
  /** Server-only. Never persisted, sent to a browser, or included in telemetry. */
  readonly cause?: Error;
}>;
export type EnrichmentCandidate = {
  readonly cacheKey: string;
  readonly definitionId: string;
  readonly definitionVersion: string;
  readonly normalizationVersion: string;
  readonly catalogHash: string;
  readonly modelRef: string;
  readonly promptHash: string;
  readonly attempt: number;
  readonly state: "classified" | "unknown" | "failed" | "running";
  readonly method: "dictionary" | "model" | "none";
  readonly labelId?: string;
  readonly reason?: string;
  readonly usage: EnrichmentUsage;
  readonly providerRequestRef?: string;
  readonly receiptId: string;
  readonly occurredAt: string;
  readonly delivery: "pending" | "delivered";
  readonly leaseUntil?: number;
  /** Operator confirmed the prior worker stopped. This never overrides maxAttempts. */
  readonly retryAuthorized?: boolean;
};
export type EnrichmentReview = {
  readonly labelId: string;
  readonly actor: string;
  readonly reason: string;
  readonly evidence: string;
  readonly revision: number;
  /** Null for an authorized manual label based on the current original, without a model/rule candidate. */
  readonly candidateRef: string | null;
  readonly definitionVersion: string;
  readonly definitionId: string;
};
export type EnrichmentItem = {
  readonly itemId: string;
  readonly inputRevision: string;
  readonly sourceRef: string;
  readonly original: string | null;
  readonly availability: "available" | "deleted" | "raw-expired" | "result-expired";
  readonly candidates: readonly EnrichmentCandidate[];
  readonly review?: EnrichmentReview;
  readonly reviewHistory: readonly EnrichmentReview[];
};
export type EnrichmentPage = {
  readonly runId: string;
  readonly revision: number;
  readonly items: readonly EnrichmentItem[];
  readonly nextOffset: number | null;
  readonly requests: number;
  /** Reservations remain charged for unknown/estimated usage; they are never reported as actual usage. */
  readonly reservedTokens: number;
  readonly status: "pending" | "partial" | "review-required" | "reviewed";
};
export type EnrichmentAudit = {
  readonly idempotencyKey: string;
  readonly fingerprint: string;
  readonly actor: string;
  readonly action: string;
  readonly reason: string;
  readonly revision: number;
  readonly exported?: readonly {
    itemId: string;
    inputRevision: string;
    labelId: string;
    reviewRevision: number;
  }[];
};
/** Adapter state, server only. Never serialize a run directly as an API response. */
export type EnrichmentRun = {
  runId: string;
  scope: EnrichmentScope;
  revision: number;
  fingerprint: string;
  requests: number;
  reservedTokens: number;
  limits: ClassificationLimits;
  rawExpiresAt: number;
  resultExpiresAt: number;
  items: {
    input: Omit<EnrichmentInput, "text" | "context"> & {
      text: string | null;
      context: Record<string, string>;
    };
    sourceHash: string;
    normalizedHash: string;
    contextHash: string;
    candidates: EnrichmentCandidate[];
    review?: EnrichmentReview;
    reviews: EnrichmentReview[];
  }[];
  audit: EnrichmentAudit[];
  /** At most one effective purge per item plus raw/result expiration; independent of command audit capacity. */
  retentionAudit: EnrichmentAudit[];
  /** Operational usage/event outbox, separate from original/result retention; contains no label or original text. */
  receipts: { itemId: string; candidate: EnrichmentCandidate }[];
};
/** create must atomically enforce immutable (scope,itemId,inputRevision) source hashes across runs.
 * Creation and CAS must be atomic across clients/processes and return detached JSON values. */
export interface EnrichmentStore {
  create(run: EnrichmentRun): Promise<EnrichmentRun>;
  load(scope: EnrichmentScope, runId: string): Promise<EnrichmentRun | null>;
  compareAndSet(run: EnrichmentRun, expectedRevision: number): Promise<boolean>;
}
export type EnrichmentCommand = {
  readonly actor: string;
  readonly reason: string;
  readonly idempotencyKey: string;
  readonly expectedRevision: number;
};
export type EnrichmentReceipt = {
  readonly scope: EnrichmentScope;
  readonly runId: string;
  readonly itemId: string;
  readonly candidate: EnrichmentCandidate;
};
