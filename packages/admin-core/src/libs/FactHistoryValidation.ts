import { Problem, ProblemCategory } from "@croco/problems-core";
import type { FactScope, FactSubject, FactValue } from "@croco/analytics-core";

export type FactHistorySelection = {
  readonly scope: FactScope;
  readonly subject: FactSubject;
  readonly definitionId: string;
  readonly definitionVersion: string;
  readonly materializationRevision: string;
};

export type FactHistoryComparisonRequest = FactHistorySelection & {
  readonly effectiveAt: string;
  readonly knownAt: string;
  readonly compareEffectiveAt: string;
  readonly compareKnownAt: string;
  readonly limit: number;
};

/** Display values must be authorized and masked by the server before crossing the UI boundary. */
export type FactHistoryDisplayRow = {
  readonly id: string;
  readonly value: string;
  readonly source: string;
  readonly sourceEventId: string;
  readonly validFrom: string;
  readonly validTo?: string;
  readonly recordedAt: string;
  readonly definitionVersion: string;
  readonly projectionId: string;
  readonly projectionRowKey: string;
  readonly materializationRevision: string;
  readonly supersedes?: string;
};

export type FactHistoryPoint = {
  readonly status: "known" | "unknown" | "conflict";
  readonly value?: string;
  readonly provenance: readonly string[];
};

export type FactHistorySnapshot = {
  readonly request: FactHistoryComparisonRequest;
  readonly revision: number;
  readonly rows: readonly FactHistoryDisplayRow[];
  readonly before: FactHistoryPoint;
  readonly after: FactHistoryPoint;
  readonly decisionSnapshot?: { readonly id: string; readonly evidence: readonly string[] };
};

export type FactHistoryState =
  | { readonly kind: "loading" }
  | { readonly kind: "denied"; readonly code: string }
  | { readonly kind: "error"; readonly code: string }
  | { readonly kind: "empty"; readonly snapshot: FactHistorySnapshot }
  | { readonly kind: "ready"; readonly snapshot: FactHistorySnapshot }
  | { readonly kind: "partial"; readonly snapshot: FactHistorySnapshot };

export type FactHistoryCorrectionRequest = FactHistorySelection & {
  readonly rowId: string;
  readonly value: FactValue;
  readonly validFrom: string;
  readonly reason: string;
  readonly source: string;
  readonly actor: string;
  readonly expectedRevision: number;
  readonly idempotencyKey: string;
};

/** Implementations call the canonical fact service with a server-authenticated principal. */
export interface FactHistoryOperations {
  compare(request: FactHistoryComparisonRequest): Promise<FactHistoryState>;
  correct(
    request: FactHistoryCorrectionRequest,
  ): Promise<{ readonly revision: number; readonly auditId: string }>;
}

export class FactHistoryInputProblem extends Problem {
  constructor(field: string) {
    super(
      "admin-core/fact-history-input",
      ProblemCategory.ValidationError,
      `Invalid fact history ${field}.`,
    );
  }
}

export function validateFactHistoryComparison(request: FactHistoryComparisonRequest): void {
  if (!Number.isInteger(request.limit) || request.limit < 1 || request.limit > 100) {
    throw new FactHistoryInputProblem("limit");
  }
  for (const field of ["effectiveAt", "knownAt", "compareEffectiveAt", "compareKnownAt"] as const) {
    if (
      !/(Z|[+-]\d{2}:\d{2})$/.test(request[field]) ||
      !Number.isFinite(Date.parse(request[field]))
    )
      throw new FactHistoryInputProblem(field);
  }
}

export function validateFactHistoryCorrection(request: FactHistoryCorrectionRequest): void {
  for (const field of ["reason", "source", "actor", "idempotencyKey", "rowId"] as const) {
    if (!request[field].trim()) throw new FactHistoryInputProblem(field);
  }
  if (!Number.isInteger(request.expectedRevision) || request.expectedRevision < 0) {
    throw new FactHistoryInputProblem("expectedRevision");
  }
  if (
    !/(Z|[+-]\d{2}:\d{2})$/.test(request.validFrom) ||
    !Number.isFinite(Date.parse(request.validFrom))
  )
    throw new FactHistoryInputProblem("validFrom");
}
