import * as React from "react";
import type { TargetingImpactReport } from "@croco/admin-core";

export type TargetingImpactInspectorState =
  | { readonly kind: "loading" }
  | { readonly kind: "empty" }
  | { readonly kind: "denied" }
  | { readonly kind: "unavailable"; readonly missingHistoryN: number }
  | { readonly kind: "error"; readonly code: string }
  | {
      readonly kind: "ready" | "partial";
      readonly report: TargetingImpactReport;
      readonly campaignCoverage?: {
        readonly memberN: number;
        readonly replayedMemberN: number;
        readonly missingHistoryN: number;
      };
    };

export type TargetingImpactInspectorProps = {
  readonly state: TargetingImpactInspectorState;
  readonly onReplay: (unknownPolicy: "preserve" | "exclude") => void;
  readonly onExport?: () => void;
};

/** Compares historical observations and declared crediting assumptions. */
export function TargetingImpactInspector({
  state,
  onReplay,
  onExport,
}: TargetingImpactInspectorProps): React.ReactElement {
  const [unknownPolicy, setUnknownPolicy] = React.useState<"preserve" | "exclude">("preserve");
  const id = React.useId();
  const busy = state.kind === "loading";
  const report = state.kind === "ready" || state.kind === "partial" ? state.report : undefined;
  return (
    <section aria-label="Targeting impact inspector" data-state={state.kind} aria-busy={busy}>
      <h2>Targeting impact inspector</h2>
      <p>
        Historical filter comparison. Observed visits and revenue do not establish causal loss or
        incremental effect.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onReplay(unknownPolicy);
        }}
      >
        <label htmlFor={id}>Missing decision-time attributes</label>{" "}
        <select
          id={id}
          value={unknownPolicy}
          disabled={busy || state.kind === "denied"}
          onChange={(event) =>
            setUnknownPolicy(event.currentTarget.value as "preserve" | "exclude")
          }
        >
          <option value="preserve">Preserve unknown subjects</option>
          <option value="exclude">Exclude unknown subjects</option>
        </select>{" "}
        <button type="submit" disabled={busy || state.kind === "denied"}>
          Compare filters
        </button>
      </form>
      {state.kind === "loading" && <p role="status">Loading historical evidence…</p>}
      {state.kind === "empty" && (
        <p role="status">No historical subjects in this snapshot. Select a populated source.</p>
      )}
      {state.kind === "denied" && (
        <p role="alert">Access denied. Request access to this tenant's historical reports.</p>
      )}
      {state.kind === "unavailable" && (
        <p role="alert">
          Historical evidence unavailable for {state.missingHistoryN} campaign members. Import
          decision-time history and compare again.
        </p>
      )}
      {state.kind === "error" && (
        <p role="alert">Comparison failed ({state.code}). Inspect the source and retry.</p>
      )}
      {state.kind === "partial" && (
        <p role="alert">
          Partial evidence. Missing history or costs remain unavailable. Supply historical evidence
          and compare again.
        </p>
      )}
      {(state.kind === "ready" || state.kind === "partial") && state.campaignCoverage && (
        <dl>
          <dt>Campaign snapshot members</dt>
          <dd>{state.campaignCoverage.memberN}</dd>
          <dt>Members with replay history</dt>
          <dd>{state.campaignCoverage.replayedMemberN}</dd>
          <dt>Members missing replay history (outside the report subset)</dt>
          <dd>{state.campaignCoverage.missingHistoryN}</dd>
        </dl>
      )}
      {report && <ImpactReport report={report} onExport={onExport} />}
    </section>
  );
}

function ImpactReport({
  report,
  onExport,
}: {
  readonly report: TargetingImpactReport;
  readonly campaignCoverage?: {
    readonly memberN: number;
    readonly replayedMemberN: number;
    readonly missingHistoryN: number;
  };
  readonly onExport?: () => void;
}): React.ReactElement {
  const result = report.result;
  return (
    <>
      <h3>Observed population and costs</h3>
      <dl>
        <dt>Existing population</dt>
        <dd>{result.baselineN}</dd>
        <dt>Kept</dt>
        <dd>{result.keptN}</dd>
        <dt>Excluded</dt>
        <dd>{result.excludedN}</dd>
        <dt>Unknown</dt>
        <dd>{result.unknownN}</dd>
        <dt>Effective kept / excluded under the selected unknown policy</dt>
        <dd>
          {result.effectiveKeptN} / {result.effectiveExcludedN}
        </dd>
        <dt>Observed dispatch cost of excluded subjects</dt>
        <dd>
          {result.observedCostSaved.amount === null
            ? "Unavailable"
            : `${result.observedCostSaved.amount} ${result.observedCostSaved.currency} (${result.observedCostSaved.unit})`}{" "}
          — {result.observedCostSaved.status}
        </dd>
        <dt>Visits before send</dt>
        <dd>{result.observedVisits.preSendN}</dd>
        <dt>Post-click visits</dt>
        <dd>{result.observedVisits.postClickN}</dd>
        <dt>Post-send visits without a prior click</dt>
        <dd>{result.observedVisits.postSendNonClickN}</dd>
        <dt>Post-send visits with unknown click history</dt>
        <dd>{result.observedVisits.postSendUnknownClickN}</dd>
      </dl>
      <h3>Crediting scenarios — assumptions, not causal estimates</h3>
      <div style={{ overflowX: "auto" }}>
        <table>
          <caption>
            Excluded subjects and unique financial events credited under each assumption
          </caption>
          <thead>
            <tr>
              <th scope="col">Scenario</th>
              <th scope="col">Evidence</th>
              <th scope="col">Visit subjects</th>
              <th scope="col">Financial events</th>
              <th scope="col">Observed revenue ({report.input.currency})</th>
            </tr>
          </thead>
          <tbody>
            {result.scenarioValues.map((scenario) => (
              <tr key={scenario.scenario}>
                <th scope="row">
                  {scenario.scenario === "click-only" ? "Click only" : "Post-send inclusive"}
                </th>
                <td>{scenario.status}</td>
                <td>
                  {scenario.status === "unavailable"
                    ? "Unavailable"
                    : scenario.excludedVisitSubjectN}
                </td>
                <td>
                  {scenario.status === "unavailable"
                    ? "Unavailable"
                    : scenario.excludedFinancialEventN}
                </td>
                <td>
                  {scenario.status === "unavailable"
                    ? "Unavailable"
                    : scenario.excludedObservedRevenue}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3>Source coverage</h3>
      <dl>
        <dt>Historical attribute coverage</dt>
        <dd>
          {result.sourceCoverage.historicalTraitsN} / {result.sourceCoverage.subjectN}
        </dd>
        <dt>Observed dispatches / costs</dt>
        <dd>
          {result.sourceCoverage.dispatchN} / {result.sourceCoverage.observedCostN}
        </dd>
        <dt>Touchpoint / outcome history rows</dt>
        <dd>
          {result.sourceCoverage.touchpointsN} / {result.sourceCoverage.outcomesN}
        </dd>
      </dl>
      <h3>Assumptions and limitations</h3>
      <ul>
        {[...result.assumptions, ...result.limitations].map((text, index) => (
          <li key={index}>{text}</li>
        ))}
      </ul>
      <h3>Report provenance</h3>
      <dl style={{ overflowWrap: "anywhere" }}>
        <dt>Source snapshot</dt>
        <dd>{report.input.snapshotRef}</dd>
        <dt>Definition revision / unknown policy</dt>
        <dd>
          {report.input.definition.revision} / {report.input.definition.unknownPolicy}
        </dd>
        <dt>Observation window</dt>
        <dd>
          {report.input.observationWindow.start} – {report.input.observationWindow.end} (
          {report.input.observationWindow.completed ? "complete" : "incomplete"})
        </dd>
        <dt>Attribution window</dt>
        <dd>{report.input.attributionWindowMs} ms</dd>
        <dt>Definition hash</dt>
        <dd>{report.definitionHash}</dd>
        <dt>Input hash</dt>
        <dd>{report.inputHash}</dd>
      </dl>
      {onExport && (
        <button type="button" onClick={onExport}>
          Export aggregate report
        </button>
      )}
    </>
  );
}
