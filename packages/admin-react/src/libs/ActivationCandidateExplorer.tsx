import * as React from "react";
import type { ActivationExplorerState, ActivationSavedReport } from "@croco/admin-core";
import type {
  ActivationCandidateResult,
  ActivationRatio,
  ActivationReport,
} from "@croco/metrics-core";

export type ActivationCandidateExplorerProps = {
  readonly state: ActivationExplorerState;
  readonly load: (signal: AbortSignal) => Promise<ActivationExplorerState>;
  readonly save: (
    candidateId: string,
    cohort: "new" | "returning",
    expectedReport: ActivationReport,
    signal: AbortSignal,
  ) => Promise<ActivationSavedReport>;
  readonly exportSaved: (id: string, signal: AbortSignal) => Promise<string>;
  readonly canWrite: boolean;
};

function ratio(value: ActivationRatio): string {
  return value.value === null
    ? `Unavailable: ${value.zeroDenominatorReason}`
    : `${(value.value * 100).toFixed(1)}%`;
}
function identity(report: ActivationReport): string {
  return JSON.stringify(report);
}
function key(value: ActivationCandidateResult): string {
  return JSON.stringify([value.candidate.id, value.cohort]);
}

export function ActivationCandidateExplorer(
  props: ActivationCandidateExplorerProps,
): React.ReactElement {
  const [state, setState] = React.useState(props.state);
  const [minSupport, setMinSupport] = React.useState(
    props.state.kind === "ready" || props.state.kind === "partial"
      ? props.state.report.definition.minSupport
      : 0,
  );
  const [selected, setSelected] = React.useState<string>();
  const [pending, setPending] = React.useState(false);
  const [failure, setFailure] = React.useState<string>();
  const [saved, setSaved] = React.useState<ActivationSavedReport>();
  const [exported, setExported] = React.useState<string>();
  const controller = React.useRef<AbortController | undefined>(undefined);
  const report = state.kind === "ready" || state.kind === "partial" ? state.report : undefined;
  const reportIdentity = report ? identity(report) : undefined;
  React.useEffect(() => {
    controller.current?.abort();
    setSelected(undefined);
    setSaved(undefined);
    setExported(undefined);
    setFailure(undefined);
    setPending(false);
    setState(props.state);
  }, [props.state]);
  React.useEffect(() => {
    if (reportIdentity === undefined) return;
    controller.current?.abort();
    setSelected(undefined);
    setSaved(undefined);
    setExported(undefined);
    setFailure(undefined);
    setPending(false);
    setMinSupport(report?.definition.minSupport ?? 0);
  }, [reportIdentity, report?.definition.minSupport]);
  React.useEffect(() => () => controller.current?.abort(), []);

  async function reload() {
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setSelected(undefined);
    setSaved(undefined);
    setExported(undefined);
    setFailure(undefined);
    setState({ kind: "loading" });
    try {
      const loaded = await props.load(request.signal);
      if (!request.signal.aborted) setState(loaded);
    } catch {
      if (!request.signal.aborted) setState({ kind: "error", code: "activation-load-failed" });
    }
  }
  async function persist(candidate: ActivationCandidateResult) {
    if (!report) return;
    const request = new AbortController();
    controller.current?.abort();
    controller.current = request;
    setPending(true);
    setFailure(undefined);
    setSaved(undefined);
    setExported(undefined);
    try {
      const record = await props.save(
        candidate.candidate.id,
        candidate.cohort,
        report,
        request.signal,
      );
      if (!request.signal.aborted) {
        if (
          identity(record.report) !== reportIdentity ||
          record.selectedCandidateId !== candidate.candidate.id ||
          record.selectedCohort !== candidate.cohort
        ) {
          setFailure(
            "Saved report does not match this selection. Reload candidates before saving again.",
          );
        } else setSaved(record);
      }
    } catch {
      if (!request.signal.aborted)
        setFailure("Report save failed. Retry saving the selected candidate.");
    } finally {
      if (!request.signal.aborted) setPending(false);
    }
  }
  async function exportReport(record: ActivationSavedReport) {
    const request = new AbortController();
    controller.current?.abort();
    controller.current = request;
    setPending(true);
    setFailure(undefined);
    try {
      const json = await props.exportSaved(record.id, request.signal);
      if (!request.signal.aborted) setExported(json);
    } catch {
      if (!request.signal.aborted) setFailure("Saved report export failed. Retry export.");
    } finally {
      if (!request.signal.aborted) setPending(false);
    }
  }
  const chosen = report?.candidates.find((candidate) => key(candidate) === selected);
  return (
    <section aria-label="Activation candidate explorer">
      <h2>Activation candidate explorer</h2>
      <p>
        Descriptive association only. These results do not establish causation or select a best
        candidate.
      </p>
      {state.kind === "loading" && <p role="status">Loading activation candidates…</p>}
      {state.kind === "empty" && <p>No activation candidates are available.</p>}
      {state.kind === "denied" && <p role="alert">Access denied: {state.code}</p>}
      {state.kind === "error" && (
        <p role="alert">Could not load activation candidates: {state.code}</p>
      )}
      {state.kind !== "loading" && (
        <button type="button" onClick={() => void reload()} disabled={pending}>
          Reload candidates
        </button>
      )}
      {report && (
        <>
          {state.kind === "partial" && (
            <p role="status">
              Partial evidence. Inspect excluded counts before interpreting results.
            </p>
          )}
          <dl>
            <dt>Definition</dt>
            <dd>
              {report.definition.id} v{report.definition.version}
            </dd>
            <dt>Subject / cohort</dt>
            <dd>
              {report.definition.subjectKind} / {report.definition.cohortPolicy}
            </dd>
            <dt>Timezone / unit</dt>
            <dd>
              {report.definition.timezone} / {report.definition.unit}
            </dd>
            <dt>Source run</dt>
            <dd>{report.definition.sourceRunRef}</dd>
            <dt>Action windows</dt>
            <dd>
              {report.definition.windows
                .map((window) => `${window.id}: ${window.fromMs}–${window.toMs} ms`)
                .join(", ")}
            </dd>
            <dt>Outcome window</dt>
            <dd>
              {report.definition.outcomeWindow.fromMs}–{report.definition.outcomeWindow.toMs} ms
            </dd>
            <dt>Source revisions</dt>
            <dd>
              {Object.entries(report.definition.sourceRevisions)
                .map(([source, revision]) => `${source}: ${revision}`)
                .join(", ")}
            </dd>
            <dt>Input rows</dt>
            <dd>{report.rowCount}</dd>
          </dl>
          <label>
            Minimum support (fraction 0–1){" "}
            <input
              type="number"
              min="0"
              max="1"
              step="0.01"
              value={minSupport}
              disabled={pending}
              onChange={(event) => {
                const value = event.currentTarget.valueAsNumber;
                if (Number.isFinite(value) && value >= 0 && value <= 1) {
                  setMinSupport(value);
                  setSelected(undefined);
                  setSaved(undefined);
                  setExported(undefined);
                  setFailure(undefined);
                }
              }}
            />
          </label>
          <div
            role="region"
            aria-label="Activation candidate comparison"
            tabIndex={0}
            style={{ overflowX: "auto" }}
          >
            <table>
              <caption>
                DO: achieved; RE: achieved and retained; NO: retained without achieving. Precision:
                RE / DO. Coverage: RE / (RE + NO). NOREDO: RE / (NO + DO).
              </caption>
              <thead>
                <tr>
                  {[
                    "Select",
                    "Candidate",
                    "Cohort",
                    "Action",
                    "Window",
                    "Threshold",
                    "Count mode",
                    "Eligible",
                    "DO",
                    "RE",
                    "NO",
                    "Support",
                    "Precision",
                    "Coverage",
                    "NOREDO",
                    "Excluded",
                  ].map((label) => (
                    <th key={label} scope="col">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.candidates
                  .filter((value) =>
                    value.support.value === null
                      ? minSupport === 0
                      : value.support.value >= minSupport,
                  )
                  .map((value) => (
                    <tr key={key(value)}>
                      <td>
                        <input
                          type="radio"
                          name="activation-candidate"
                          aria-label={`Select ${value.candidate.id} ${value.cohort}`}
                          checked={selected === key(value)}
                          disabled={pending}
                          onChange={() => {
                            setSelected(key(value));
                            setSaved(undefined);
                            setExported(undefined);
                            setFailure(undefined);
                          }}
                        />
                      </td>
                      <th scope="row">{value.candidate.id}</th>
                      <td>{value.cohort}</td>
                      <td>{value.candidate.actionId}</td>
                      <td>{value.candidate.windowId}</td>
                      <td>{value.candidate.threshold}</td>
                      <td>{value.candidate.countMode}</td>
                      <td>{value.eligibleN}</td>
                      <td>{value.DO}</td>
                      <td>{value.RE}</td>
                      <td>{value.NO}</td>
                      <td>{ratio(value.support)}</td>
                      <td>{ratio(value.precision)}</td>
                      <td>{ratio(value.coverage)}</td>
                      <td>{ratio(value.noRedo)}</td>
                      <td>
                        {Object.entries(value.excluded).map(([reason, count]) => (
                          <div key={reason}>
                            {reason}: {count}
                          </div>
                        ))}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          {chosen && (
            <section aria-label="Selected candidate achievement curve">
              <h3>Time to achievement</h3>
              {chosen.achievementCurve.status === "unsupported" ? (
                <p>Unavailable: {chosen.achievementCurve.reason}</p>
              ) : (
                <div
                  role="region"
                  aria-label="Achievement times"
                  tabIndex={0}
                  style={{ overflowX: "auto" }}
                >
                  <table>
                    <thead>
                      <tr>
                        <th>Elapsed milliseconds</th>
                        <th>Achieved</th>
                        <th>Fraction</th>
                      </tr>
                    </thead>
                    <tbody>
                      {chosen.achievementCurve.points.map((point) => (
                        <tr key={point.elapsedMs}>
                          <td>{point.elapsedMs}</td>
                          <td>{point.achieved}</td>
                          <td>{(point.fraction * 100).toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
          {!props.canWrite && <p>Report write permission is required to save a candidate.</p>}
          <button
            type="button"
            disabled={!chosen || !props.canWrite || pending}
            onClick={() => {
              if (chosen) void persist(chosen);
            }}
          >
            {pending ? "Working…" : "Save selected candidate"}
          </button>
          {saved && (
            <>
              <p role="status">Report saved: {saved.id}</p>
              <button type="button" disabled={pending} onClick={() => void exportReport(saved)}>
                Export saved report
              </button>
            </>
          )}
          {failure && <p role="alert">{failure}</p>}
          {exported !== undefined && (
            <label>
              Verified saved report JSON
              <textarea readOnly value={exported} rows={8} />
            </label>
          )}
        </>
      )}
    </section>
  );
}
