import { useRef, useState } from "react";
import type {
  GrowthWorkbenchRequest,
  GrowthWorkbenchState,
  GrowthWorkbenchReport,
  GrowthReportRecord,
} from "@croco/admin-core";

export type GrowthWorkbenchClient = {
  load(request: GrowthWorkbenchRequest): Promise<GrowthWorkbenchState>;
  save(
    request: GrowthWorkbenchRequest,
    id: string,
    revision: number,
    analysisHash: string,
  ): Promise<GrowthReportRecord>;
  readSaved(
    scope: GrowthWorkbenchRequest["scope"],
    id: string,
  ): Promise<GrowthReportRecord | undefined>;
};
export type GrowthModelWorkbenchProps = {
  client: GrowthWorkbenchClient;
  initialRequest: GrowthWorkbenchRequest;
};
const display = (value: number | null) =>
  value === null ? "Unknown" : value.toLocaleString(undefined, { maximumFractionDigits: 3 });
function Results({ report }: { report: GrowthWorkbenchReport }) {
  return (
    <section aria-label={`Results ${report.model.version}`}>
      <h2>
        {report.model.id} · {report.model.version}
      </h2>
      <p>{report.model.purpose}</p>
      <p>
        Scope: {report.scope.appId} / {report.scope.environment} / {report.scope.tenantId}. Unit:{" "}
        {report.model.unit} per {report.model.period}.
      </p>
      <p>
        Observed source: {report.sourceRevision}. Cutoff: {report.cutoff}. State partition:{" "}
        {report.partitionValidation === "aggregate-only"
          ? "Aggregate only — individual membership not verified"
          : "Subject history validated"}
        .
      </p>
      <p>
        Calculation: first-order Markov, row-vector. Forecasts are fractional expected populations.
        Scenario changes are assumptions; intervention effects are not established.
      </p>
      <ul>
        {report.model.assumptions.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ul>
      <h3>Observed state populations</h3>
      <div style={{ overflowX: "auto" }}>
        <table>
          <caption>Observed history · incomplete periods remain unknown</caption>
          <thead>
            <tr>
              <th>Period</th>
              {report.model.stateDefinitions.map((s) => (
                <th key={s.id}>{s.label}</th>
              ))}
              <th>Completeness</th>
            </tr>
          </thead>
          <tbody>
            {report.observedPopulations.map((p) => (
              <tr key={p.period}>
                <th>{p.period}</th>
                {p.values.map((v, i) => (
                  <td key={i}>{p.complete ? display(v) : "Unknown"}</td>
                ))}
                <td>{p.complete ? "Complete" : "Incomplete"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3>Estimated transition matrix</h3>
      <p>
        Method: {report.estimate.method}. Training populations: {report.estimate.window.from}–
        {report.estimate.window.to}. Included steps: {report.estimate.includedPeriods.join(", ")}.
        Excluded steps: {report.estimate.excludedPeriods.join(", ") || "None"}.
      </p>
      <div style={{ overflowX: "auto" }}>
        <table>
          <caption>Observed transition estimates · origin → destination</caption>
          <thead>
            <tr>
              <th>Origin</th>
              {report.model.stateDefinitions.map((s) => (
                <th key={s.id}>{s.label}</th>
              ))}
              <th>Observed denominator</th>
            </tr>
          </thead>
          <tbody>
            {report.estimate.matrix.map((row, i) => (
              <tr key={i}>
                <th>{report.model.stateDefinitions[i]?.label}</th>
                {row.map((v, j) => (
                  <td key={j}>{display(v)}</td>
                ))}
                <td>{report.estimate.rowDenominators[i]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3>Scenario projection · calculated expectation</h3>
      <p>
        Horizon: {report.scenario.horizon} {report.model.period} periods. Inflows: assumption —{" "}
        {report.scenario.inflows.rationale}. Row corrections:{" "}
        {report.scenario.matrixOverrides
          .map((o) => `${o.stateId}: ${o.method} (${o.rationale})`)
          .join("; ") || "No overrides"}
        .
      </p>
      <div style={{ overflowX: "auto" }}>
        <table>
          <caption>
            Expected population by step · display rounding is never simulation input
          </caption>
          <thead>
            <tr>
              <th>Step</th>
              {report.model.stateDefinitions.map((s) => (
                <th key={s.id}>{s.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {report.projection.populations.map((row, i) => (
              <tr key={i}>
                <th>{i}</th>
                {row.map((v, j) => (
                  <td key={j}>{display(v)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3>Historical validation</h3>
      <p>
        Backtest inflows: assumption — {report.backtestAssumptions.rationale}. These inflows are
        user assumptions and must be chosen before the training cutoff.
      </p>
      <p>
        Train end: {report.backtest.trainEnd}. Test: {report.backtest.testWindow.from}–
        {report.backtest.testWindow.to}. Baseline: last-value. Error: {report.backtest.errorMetric}{" "}
        ({report.backtest.errorUnit}). Zero actual MAPE is undefined and retained with its reason.
      </p>
      <p>
        Mean model error: {display(report.backtest.meanModelError)}. Mean baseline error:{" "}
        {display(report.backtest.meanBaselineError)}.{" "}
        {report.backtest.summaryReason ?? "All cells included"}.
      </p>
      <div style={{ overflowX: "auto" }}>
        <table>
          <caption>Model and baseline errors · every state and test period</caption>
          <thead>
            <tr>
              {[
                "Period",
                "State",
                "Actual",
                "Model",
                "Last value",
                "Model error",
                "Baseline error",
                "Reason",
              ].map((s) => (
                <th key={s}>{s}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {report.backtest.results.map((r) => (
              <tr key={`${r.period}:${r.stateId}`}>
                <th>{r.period}</th>
                <td>{r.stateId}</td>
                {[r.actual, r.projected, r.baseline, r.modelError, r.baselineError].map((v, i) => (
                  <td key={i}>{display(v)}</td>
                ))}
                <td>{r.reason ?? "Available"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {report.diagnostics.length > 0 && (
        <ul aria-label="Source diagnostics">
          {report.diagnostics.map((d, i) => (
            <li key={i}>
              Period {d.period}: {d.reason} ({d.count})
            </li>
          ))}
        </ul>
      )}
      <details>
        <summary>Report identity</summary>
        <p style={{ overflowWrap: "anywhere" }}>
          Model {report.modelHash}
          <br />
          Input {report.inputHash}
          <br />
          Analysis {report.analysisHash}
        </p>
      </details>
    </section>
  );
}
/** Browser submits editable definitions and assumptions to the same server calculation boundary. */
export function GrowthModelWorkbench({ client, initialRequest }: GrowthModelWorkbenchProps) {
  const [modelText, setModelText] = useState(JSON.stringify(initialRequest.model, null, 2));
  const [scenarioText, setScenarioText] = useState(
    JSON.stringify(initialRequest.scenario, null, 2),
  );
  const [backtestText, setBacktestText] = useState(
    JSON.stringify(initialRequest.backtest, null, 2),
  );
  const [state, setState] = useState<GrowthWorkbenchState>({
    kind: "empty",
    code: "Enter a definition and calculate",
  });
  const [lastRequest, setLastRequest] = useState<GrowthWorkbenchRequest>();
  const [recordId, setRecordId] = useState("growth-report");
  const [saved, setSaved] = useState<GrowthReportRecord>();
  const [comparison, setComparison] = useState<GrowthWorkbenchReport>();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  function edit(setter: (value: string) => void, value: string) {
    generation.current++;
    setter(value);
    setLastRequest(undefined);
    setState({ kind: "empty", code: "Inputs changed — calculate to inspect results" });
    setMessage("");
  }
  async function calculate() {
    const current = ++generation.current;
    setState({ kind: "loading" });
    setLastRequest(undefined);
    try {
      const request: GrowthWorkbenchRequest = {
        scope: initialRequest.scope,
        sourceRevision: initialRequest.sourceRevision,
        model: JSON.parse(modelText),
        scenario: JSON.parse(scenarioText),
        backtest: JSON.parse(backtestText),
      };
      const next = await client.load(request);
      if (current !== generation.current) return;
      setState(next);
      if (next.kind === "ready") setLastRequest(request);
    } catch {
      if (current === generation.current)
        setState({ kind: "error", code: "growth-workbench/input-or-network-failed" });
    }
  }
  async function save() {
    if (state.kind !== "ready" || !lastRequest) return;
    const current = generation.current;
    setBusy(true);
    try {
      const record = await client.save(
        lastRequest,
        recordId,
        saved?.id === recordId ? saved.revision : 0,
        state.report.analysisHash,
      );
      if (current === generation.current) {
        setSaved(record);
        setMessage(`Saved revision ${record.revision} by ${record.actor}.`);
      }
    } catch {
      if (current === generation.current)
        setMessage("Save rejected: permission, stale input or revision conflict.");
    } finally {
      setBusy(false);
    }
  }
  async function compare() {
    const current = generation.current;
    setBusy(true);
    try {
      const record = await client.readSaved(initialRequest.scope, recordId);
      if (current !== generation.current) return;
      setSaved(record);
      setComparison(record?.report);
      setMessage(
        record
          ? `Historical saved revision ${record.revision} by ${record.actor}.`
          : "No saved report.",
      );
    } catch {
      if (current === generation.current) setMessage("Saved report access failed.");
    } finally {
      setBusy(false);
    }
  }
  let definition: GrowthWorkbenchRequest["model"] | undefined;
  try {
    const candidate = JSON.parse(modelText) as GrowthWorkbenchRequest["model"];
    if (
      candidate &&
      typeof candidate.purpose === "string" &&
      typeof candidate.version === "string" &&
      Array.isArray(candidate.stateDefinitions) &&
      candidate.stateDefinitions.every(
        (s) =>
          s &&
          typeof s.id === "string" &&
          typeof s.label === "string" &&
          typeof s.evidence === "string",
      )
    )
      definition = candidate;
  } catch {
    /* Invalid JSON is reported by the calculate action; retain the editable text. */
  }
  function changeDefinition(value: GrowthWorkbenchRequest["model"]) {
    edit(setModelText, JSON.stringify(value, null, 2));
  }
  return (
    <section aria-label="Growth Model Workbench" data-state={state.kind}>
      <h1>Growth Model Workbench</h1>
      <p>
        Define meaningful states, inspect observed transitions, compare assumed changes, and check
        historical errors against a simple baseline.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void calculate();
        }}
      >
        {definition && (
          <fieldset>
            <legend>Model purpose and state evidence</legend>
            <label>
              Model version
              <input
                value={definition.version}
                onChange={(e) => {
                  if (definition) changeDefinition({ ...definition, version: e.target.value });
                }}
              />
            </label>
            <label>
              Decision purpose
              <input
                style={{ width: "100%", boxSizing: "border-box" }}
                value={definition.purpose}
                onChange={(e) => {
                  if (definition) changeDefinition({ ...definition, purpose: e.target.value });
                }}
              />
            </label>
            {definition.stateDefinitions.map((state, i) => (
              <fieldset key={i}>
                <legend>State {state.id}</legend>
                <label>
                  State label
                  <input
                    value={state.label}
                    onChange={(e) => {
                      if (definition)
                        changeDefinition({
                          ...definition,
                          stateDefinitions: definition.stateDefinitions.map((s, j) =>
                            j === i ? { ...s, label: e.target.value } : s,
                          ),
                        });
                    }}
                  />
                </label>
                <label>
                  State partition evidence
                  <input
                    style={{ width: "100%", boxSizing: "border-box" }}
                    value={state.evidence}
                    onChange={(e) => {
                      if (definition)
                        changeDefinition({
                          ...definition,
                          stateDefinitions: definition.stateDefinitions.map((s, j) =>
                            j === i ? { ...s, evidence: e.target.value } : s,
                          ),
                        });
                    }}
                  />
                </label>
              </fieldset>
            ))}
          </fieldset>
        )}
        <label>
          Model definition · state evidence, purpose, version and assumptions
          <textarea
            style={{ width: "100%", boxSizing: "border-box" }}
            rows={16}
            value={modelText}
            onChange={(e) => edit(setModelText, e.target.value)}
          />
        </label>
        <label>
          Scenario assumptions · horizon, initial populations, inflows and full replacement rows
          <textarea
            style={{ width: "100%", boxSizing: "border-box" }}
            rows={10}
            value={scenarioText}
            onChange={(e) => edit(setScenarioText, e.target.value)}
          />
        </label>
        <p>
          Use method “replace-row” and explain which same-row probability you transfer. Rows must
          sum to 1; no automatic normalization.
        </p>
        <label>
          Backtest · fixed train cutoff, test window, MAE or MAPE
          <textarea
            style={{ width: "100%", boxSizing: "border-box" }}
            rows={8}
            value={backtestText}
            onChange={(e) => edit(setBacktestText, e.target.value)}
          />
        </label>
        <button type="submit" disabled={state.kind === "loading"}>
          Calculate model and scenario
        </button>
      </form>
      <p role={state.kind === "denied" || state.kind === "error" ? "alert" : "status"}>
        {state.kind === "ready"
          ? "Calculation ready"
          : state.kind === "loading"
            ? "Loading observed input and calculating…"
            : `${state.kind}: ${state.code}`}
      </p>
      <label>
        Report ID
        <input
          value={recordId}
          disabled={state.kind === "loading" || busy}
          onChange={(e) => {
            generation.current++;
            setRecordId(e.target.value);
            setSaved(undefined);
            setComparison(undefined);
            setMessage("");
          }}
        />
      </label>
      <button
        type="button"
        disabled={state.kind !== "ready" || !lastRequest || busy}
        onClick={() => void save()}
      >
        Save report revision
      </button>
      <button type="button" disabled={busy} onClick={() => void compare()}>
        Compare saved model version
      </button>
      <p role="status">{message}</p>
      {state.kind === "ready" && <Results report={state.report} />}
      {comparison && (
        <section aria-label="Historical model comparison">
          <h2>Saved model version · historical evidence</h2>
          <Results report={comparison} />
        </section>
      )}
    </section>
  );
}
