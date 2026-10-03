import type { MetricDefinitionIdentity, MetricWindow } from "@croco/metrics-core";

export type AnalysisParameter =
  | null
  | boolean
  | number
  | string
  | readonly AnalysisParameter[]
  | { readonly [key: string]: AnalysisParameter };
export type AnalysisPlan = {
  /** Opaque server binding to the authenticated scope and its authorization revision. */
  readonly contextRef: string;
  readonly queryId: string;
  readonly version: number;
  readonly parameters: AnalysisParameter;
  readonly window: MetricWindow;
  readonly metricDefinition: MetricDefinitionIdentity;
  readonly assumptions: readonly string[];
  readonly coverage: "confirmation-required";
};
export type AnalysisChoice = {
  readonly id: string;
  readonly label: string;
  readonly plan: AnalysisPlan;
};
export type AnalysisUsage =
  | {
      readonly kind: "known" | "estimated";
      readonly inputTokens: number;
      readonly outputTokens: number;
    }
  | { readonly kind: "unknown" };
export type AnalysisProposal =
  | {
      readonly status: "confirmation";
      readonly choices: readonly AnalysisChoice[];
      readonly usage: AnalysisUsage;
    }
  | {
      readonly status: "unavailable";
      readonly reason:
        | "unsupported"
        | "no-definitions"
        | "definitions-changed"
        | "truncated"
        | "refused";
      readonly usage: AnalysisUsage;
    };
export type AnalysisFact = { readonly label: string; readonly value: string | null };
export type AnalysisAnswer = {
  readonly facts: readonly AnalysisFact[];
  readonly sourceRefs: readonly string[];
  readonly snapshotRefs: readonly string[];
  readonly window: MetricWindow;
  readonly population: string;
  readonly metricDefinition: MetricDefinitionIdentity;
  readonly availability: "ready" | "missing";
  readonly limitations: readonly string[];
  readonly source: "report" | "executor";
  readonly numerator?: string;
  readonly denominator?: string;
};
export type AnalysisOutcome =
  | { readonly status: "ready"; readonly answer: AnalysisAnswer }
  | { readonly status: "partial" | "stale" | "denied" | "unavailable" | "definition-changed" };
export type AnalysisModelLimits = {
  readonly maxInputBytes: number;
  readonly maxOutputBytes: number;
  readonly maxOutputTokens: number;
  readonly maxTimeMs: number;
  readonly maxConcurrency: number;
};
export type AnalysisModelRequest = {
  readonly question: string;
  readonly allowedDefinitions: readonly MetricDefinitionIdentity[];
  readonly choices: readonly AnalysisChoice[];
  readonly signal: AbortSignal;
  readonly limits: AnalysisModelLimits;
};
export type AnalysisModelResponse = {
  readonly json: string;
  readonly usage: AnalysisUsage;
  readonly completion: "complete" | "truncated" | "refused" | "failed" | "cancelled";
  /** Server-only diagnostic cause. Never copied into an answer, receipt, or public Problem. */
  readonly cause?: Error;
};
/**
 * Implementations must honor request.signal and settle promptly after it aborts.
 * The service retains the concurrency slot until this promise settles, including
 * after cancellation or timeout. A provider that never settles keeps its slot occupied.
 */
export type ProposeAnalysisPlan = (request: AnalysisModelRequest) => Promise<AnalysisModelResponse>;
