import * as React from "react";

export type MetricInspectorResult = {
  readonly definition: {
    readonly id: string;
    readonly version: number;
    readonly hash: string;
    readonly sourceRefs: readonly string[];
  };
  readonly unit: string;
  readonly population: string;
  readonly filter: string;
  readonly fieldRefs: readonly string[];
  readonly numerator?: string;
  readonly denominator?: string;
  readonly snapshotRefs: readonly string[];
  readonly quality: {
    readonly temporalCompleteness: "complete" | "partial";
    readonly freshness: "fresh" | "stale";
    readonly populationCoverage: "complete" | "partial";
    readonly validity: "valid" | "invalid";
    readonly exactness: "exact" | "approximate";
    readonly reproducibility: "reproducible" | "unverified";
  };
  readonly diagnostics: readonly string[];
};

export type MetricInspectorOutcome =
  | { readonly status: "verified"; readonly result: MetricInspectorResult }
  | { readonly status: "partial"; readonly evidence: MetricInspectorResult }
  | { readonly status: "stale"; readonly evidence: MetricInspectorResult }
  | { readonly status: "denied" }
  | { readonly status: "unavailable" };

export type MetricInspectorProps = { readonly outcome: MetricInspectorOutcome };

const outcomeMessages = {
  partial: "Metric evidence is incomplete. Inspect the source and retry the read.",
  stale: "Metric evidence is stale. Refresh the source and retry the read.",
  denied: "Access to this metric was denied. Request access from an administrator.",
  unavailable: "Metric evidence is unavailable. Retry the read later.",
} as const;

export function MetricInspector({ outcome }: MetricInspectorProps): React.ReactElement {
  if (outcome.status === "denied" || outcome.status === "unavailable") {
    return (
      <section aria-label="Metric inspector" data-state={outcome.status}>
        <h2>Metric inspector</h2>
        <p role="alert">{outcomeMessages[outcome.status]}</p>
      </section>
    );
  }

  const result = outcome.status === "verified" ? outcome.result : outcome.evidence;
  const { definition, quality } = result;
  const qualityAxes = [
    ["Temporal completeness", quality.temporalCompleteness],
    ["Freshness", quality.freshness],
    ["Population coverage", quality.populationCoverage],
    ["Validity", quality.validity],
    ["Exactness", quality.exactness],
    ["Reproducibility", quality.reproducibility],
  ] as const;

  return (
    <section aria-label="Metric inspector" data-state={outcome.status}>
      <h2>Metric inspector</h2>
      {outcome.status === "verified" ? (
        <p role="status">Verified metric evidence</p>
      ) : (
        <p role="alert">{outcomeMessages[outcome.status]}</p>
      )}
      <dl>
        <dt>Definition ID</dt>
        <dd>{definition.id}</dd>
        <dt>Definition version</dt>
        <dd>{definition.version}</dd>
        <dt>Definition hash</dt>
        <dd>{definition.hash}</dd>
        <dt>Unit</dt>
        <dd>{result.unit}</dd>
        <dt>Population</dt>
        <dd>{result.population}</dd>
        <dt>Filter</dt>
        <dd>{result.filter}</dd>
        {result.numerator !== undefined && (
          <>
            <dt>Numerator</dt>
            <dd>{result.numerator}</dd>
          </>
        )}
        {result.denominator !== undefined && (
          <>
            <dt>Denominator</dt>
            <dd>{result.denominator}</dd>
          </>
        )}
      </dl>
      <section aria-label="Metric field references">
        <h3>Field references</h3>
        {result.fieldRefs.length > 0 ? (
          <ul>
            {result.fieldRefs.map((ref) => (
              <li key={ref}>{ref}</li>
            ))}
          </ul>
        ) : (
          <p>None reported</p>
        )}
      </section>
      <section aria-label="Metric source references">
        <h3>Source references</h3>
        {definition.sourceRefs.length > 0 ? (
          <ul>
            {definition.sourceRefs.map((ref) => (
              <li key={ref}>{ref}</li>
            ))}
          </ul>
        ) : (
          <p>None reported</p>
        )}
      </section>
      <section aria-label="Metric snapshot references">
        <h3>Snapshot references</h3>
        {result.snapshotRefs.length > 0 ? (
          <ul>
            {result.snapshotRefs.map((ref) => (
              <li key={ref}>{ref}</li>
            ))}
          </ul>
        ) : (
          <p>None reported</p>
        )}
      </section>
      <section aria-label="Metric quality">
        <h3>Quality</h3>
        <dl>
          {qualityAxes.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section aria-label="Metric diagnostics">
        <h3>Diagnostics</h3>
        {result.diagnostics.length > 0 ? (
          <ul>
            {result.diagnostics.map((diagnostic, index) => (
              <li key={index}>{diagnostic}</li>
            ))}
          </ul>
        ) : (
          <p>None reported</p>
        )}
      </section>
    </section>
  );
}
