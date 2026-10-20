import * as React from "react";
import type { SeoDefinition, SeoComparisonRow, SeoPeriodValue } from "@croco/metrics-core";
import type { SeoWorkbenchState } from "@croco/admin-core";

export type SeoWorkbenchProps = {
  /** Authenticated scope identity; changing it unmounts all previous scope state. */
  scopeKey: string;
  definition: SeoDefinition;
  read(
    definition: SeoDefinition,
    offset: number,
    limit: number,
    signal: AbortSignal,
  ): Promise<SeoWorkbenchState>;
  onExport?(definition: SeoDefinition, inputHash: string, signal: AbortSignal): Promise<void>;
  onSave?(definition: SeoDefinition, inputHash: string, signal: AbortSignal): Promise<void>;
  /** Only register diagnostics that actually exist and enforce their own server authority. */
  diagnostics?: readonly {
    id: string;
    label: string;
    inspect(pageId: string, signal: AbortSignal): Promise<string>;
  }[];
};
export function SeoWorkbench(props: SeoWorkbenchProps): React.ReactElement {
  return <Workbench key={props.scopeKey} {...props} />;
}
function value(n: number | null | undefined): string {
  return n == null
    ? "Unavailable"
    : new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 }).format(n);
}
function Period({ period }: { period: SeoPeriodValue | null }) {
  if (!period) return <p>Period row missing; no zero inferred.</p>;
  return (
    <dl style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: ".35rem" }}>
      {Object.entries({
        Impressions: period.impressions,
        Clicks: period.clicks,
        CTR: period.ctr,
        "Source position": period.position,
        Sessions: period.sessions,
        "Server-confirmed outcomes": period.outcomes,
        "Value rate": period.valueRate,
        "LCP p75 (ms)": period.lcpP75,
      }).map(([label, n]) => (
        <React.Fragment key={label}>
          <dt>{label}</dt>
          <dd style={{ margin: 0 }}>{value(n)}</dd>
        </React.Fragment>
      ))}
      <dt>Mapping sources</dt>
      <dd>{period.mappingRefs.join(", ")}</dd>
      <dt>Quality</dt>
      <dd>{period.reasons.join(", ") || "Complete at declared grain"}</dd>
    </dl>
  );
}
function Workbench(props: SeoWorkbenchProps): React.ReactElement {
  const [draft, setDraft] = React.useState(props.definition);
  const [applied, setApplied] = React.useState(props.definition);
  const [state, setState] = React.useState<SeoWorkbenchState>({ kind: "loading" });
  const [detail, setDetail] = React.useState<SeoComparisonRow | null>(null);
  const [message, setMessage] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const pending = React.useRef<AbortController | null>(null);
  const heading = React.useRef<HTMLHeadingElement>(null);
  const detailHeading = React.useRef<HTMLHeadingElement>(null);
  const selectedButton = React.useRef<HTMLButtonElement | null>(null);
  const id = React.useId();
  const readRef = React.useRef(props.read);
  const definitionRef = React.useRef(props.definition);
  React.useLayoutEffect(() => {
    readRef.current = props.read;
    definitionRef.current = props.definition;
  });
  const definitionKey = JSON.stringify([
    props.definition.id,
    props.definition.version,
    props.definition.baselineWindow.from,
    props.definition.baselineWindow.to,
    props.definition.currentWindow.from,
    props.definition.currentWindow.to,
    props.definition.minImpressions,
    props.definition.minSessions,
    props.definition.minImpressionGrowth,
    props.definition.minClickDecline,
    props.definition.minValueRateDecline,
    props.definition.candidate,
  ]);
  const load = React.useCallback(async (definition: SeoDefinition, offset: number) => {
    pending.current?.abort();
    const request = new AbortController();
    pending.current = request;
    setState({ kind: "loading" });
    setDetail(null);
    setMessage("");
    setBusy(true);
    try {
      const next = await readRef.current(definition, offset, 25, request.signal);
      if (pending.current === request) {
        setState(next);
        setApplied(definition);
        heading.current?.focus();
      }
    } catch {
      if (pending.current === request) setState({ kind: "error", code: "SEO_READ_ERROR" });
    } finally {
      if (pending.current === request) {
        pending.current = null;
        setBusy(false);
      }
    }
  }, []);
  React.useEffect(() => {
    setDraft(definitionRef.current);
    void load(definitionRef.current, 0);
    return () => {
      pending.current?.abort();
      pending.current = null;
    };
  }, [load, definitionKey]);
  React.useEffect(() => {
    if (detail) detailHeading.current?.focus();
  }, [detail]);
  async function action(run: (signal: AbortSignal) => Promise<void | string>) {
    pending.current?.abort();
    const request = new AbortController();
    pending.current = request;
    setBusy(true);
    setMessage("");
    try {
      const result = await run(request.signal);
      if (pending.current === request)
        setMessage(typeof result === "string" ? result : "Operation complete");
    } catch {
      if (pending.current === request)
        setMessage("Operation failed or permission changed. Refresh before retrying.");
    } finally {
      if (pending.current === request) {
        pending.current = null;
        setBusy(false);
      }
    }
  }
  const page = "page" in state ? state.page : null;
  return (
    <section
      aria-label="SEO workbench"
      aria-busy={busy}
      data-state={state.kind}
      style={{
        maxWidth: "76rem",
        padding: "1rem",
        fontFamily: "system-ui",
        lineHeight: 1.5,
        overflowWrap: "anywhere",
      }}
    >
      <h2 ref={heading} tabIndex={-1}>
        SEO workbench
      </h2>
      <p>
        Compare search visibility with landing experience and value actions. Candidates are
        observational signals.
      </p>
      <p>
        Thresholds are relative changes (0.1 = 10%). Periods use UTC instants; to is exclusive.
        Daily boundaries must match the source timezone. Baseline must end at or before the current
        start.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void load({ ...draft }, 0);
        }}
      >
        <fieldset disabled={busy} style={{ display: "flex", flexWrap: "wrap", gap: "1rem" }}>
          <legend>Saved comparison definition</legend>
          <label htmlFor={`${id}-candidate`}>
            Candidate filter{" "}
            <select
              id={`${id}-candidate`}
              value={draft.candidate}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  candidate: event.currentTarget.value as SeoDefinition["candidate"],
                })
              }
            >
              <option value="all">All pages</option>
              <option value="impressions-up-clicks-down">Impressions up, clicks down</option>
              <option value="value-rate-down">Value rate down</option>
            </select>
          </label>
          {(
            [
              ["minImpressions", "Minimum impressions", 1],
              ["minSessions", "Minimum sessions", 1],
              ["minImpressionGrowth", "Minimum impression growth", 0.01],
              ["minClickDecline", "Minimum click decline", 0.01],
              ["minValueRateDecline", "Minimum value rate decline", 0.01],
            ] as const
          ).map(([field, label, step]) => (
            <label key={field} htmlFor={`${id}-${field}`}>
              {label}{" "}
              <input
                id={`${id}-${field}`}
                style={{ width: "6rem" }}
                type="number"
                min={0}
                max={
                  step === 1
                    ? Number.MAX_SAFE_INTEGER
                    : field === "minImpressionGrowth"
                      ? undefined
                      : 1
                }
                step={step}
                required
                value={draft[field]}
                onChange={(event) =>
                  setDraft({ ...draft, [field]: event.currentTarget.valueAsNumber })
                }
              />
            </label>
          ))}
          {(["baselineWindow", "currentWindow"] as const).map((period) =>
            (["from", "to"] as const).map((edge) => (
              <label key={`${period}-${edge}`} htmlFor={`${id}-${period}-${edge}`}>
                {period === "baselineWindow" ? "Baseline" : "Current"} {edge} (UTC)
                <input
                  id={`${id}-${period}-${edge}`}
                  type="datetime-local"
                  step={60}
                  required
                  value={draft[period][edge].slice(0, 16)}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      [period]: {
                        ...draft[period],
                        [edge]: event.currentTarget.value
                          ? `${event.currentTarget.value}:00.000Z`
                          : "",
                      },
                    })
                  }
                />
              </label>
            )),
          )}
          <button type="submit">Apply definition</button>
        </fieldset>
      </form>
      <p role="status">
        {busy ? "Loading…" : state.kind}
        {message ? ` · ${message}` : ""}
      </p>
      {"code" in state && (
        <p role="alert">{state.code}. No source failure is treated as an empty result.</p>
      )}
      {page && (
        <>
          <p>
            Definition {page.report.definition.id} / {page.report.definition.version} · Population{" "}
            {page.report.population} · Included {page.report.included} · Excluded{" "}
            {page.report.excluded}
          </p>
          <details>
            <summary>Sources, denominators and assumptions</summary>
            <p>Input hash: {page.report.inputHash}</p>
            {page.report.sources.map((source, index) => (
              <article key={index}>
                <h3>
                  {source.unit}: {source.source}
                </h3>
                <p>
                  Revision {source.sourceRevision} · Definition {source.definitionVersion} ·{" "}
                  {source.grain}
                </p>
                <p>
                  {source.window.from} to {source.window.to} · {source.timezone}
                </p>
                <p>
                  Rows: {source.rowCount} · Denominator: {source.denominator} ·{" "}
                  {source.completeness} · Coverage {source.coverage} · State {source.state}
                </p>
              </article>
            ))}
            <p>
              Unmapped {page.report.unmappedRows} · Missing queries {page.report.missingQueryRows} ·
              Anonymous queries {page.report.anonymousQueryRows}
            </p>
            <ul>
              {[...page.report.assumptions, ...page.report.diagnostics].map((reason, index) => (
                <li key={index}>{reason}</li>
              ))}
            </ul>
          </details>
          {page.report.changes.length > 0 && (
            <aside aria-label="Content and deployment markers">
              <h3>Change markers</h3>
              {page.report.changes.map((change, index) => (
                <p key={index}>
                  {change.at}: {change.label} ({change.sourceRef})
                </p>
              ))}
              <p>Timing does not establish causation.</p>
            </aside>
          )}
          {page.total === 0 ? (
            <p>
              {state.kind === "partial"
                ? "No comparison rows are available. Review incomplete evidence, source coverage and exclusions."
                : "No pages match this definition. Check population, exclusions and source coverage."}
            </p>
          ) : (
            <div
              role="region"
              aria-label="Scrollable comparison table"
              tabIndex={0}
              style={{ overflowX: "auto", maxWidth: "100%" }}
            >
              <table style={{ width: "100%", minWidth: "68rem", borderCollapse: "collapse" }}>
                <caption>
                  Search and landing comparison by page, template, locale and device
                </caption>
                <thead>
                  <tr>
                    {[
                      "Page / template / locale / device",
                      "Baseline search",
                      "Current search",
                      "Baseline landing",
                      "Current landing",
                      "Candidates / quality",
                    ].map((label) => (
                      <th scope="col" key={label} style={{ textAlign: "left", padding: ".5rem" }}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {page.rows.map((row, index) => (
                    <tr key={index}>
                      <th scope="row" style={{ textAlign: "left", padding: ".5rem" }}>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={(event) => {
                            selectedButton.current = event.currentTarget;
                            setDetail(row);
                            setMessage("");
                          }}
                        >
                          {row.pageId}
                        </button>
                        <p>
                          {row.template} / {row.locale} / {row.device}
                        </p>
                      </th>
                      {[row.baseline, row.current].map((p, i) => (
                        <td key={`s${i}`} style={{ padding: ".5rem" }}>
                          Impressions {value(p?.impressions)}
                          <br />
                          Clicks {value(p?.clicks)}
                          <br />
                          CTR {value(p?.ctr)}
                        </td>
                      ))}
                      {[row.baseline, row.current].map((p, i) => (
                        <td key={`l${i}`} style={{ padding: ".5rem" }}>
                          Sessions {value(p?.sessions)}
                          <br />
                          Outcomes {value(p?.outcomes)}
                          <br />
                          Value rate {value(p?.valueRate)}
                        </td>
                      ))}
                      <td style={{ padding: ".5rem" }}>
                        {row.candidates.join(", ") || "No candidate"}
                        <br />
                        {[
                          ...row.reasons,
                          ...(row.baseline?.reasons ?? []),
                          ...(row.current?.reasons ?? []),
                        ].join(", ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <nav aria-label="Comparison pages">
            <button
              type="button"
              disabled={busy || page.offset === 0}
              onClick={() => void load(applied, Math.max(0, page.offset - 25))}
            >
              Previous page
            </button>
            <span>
              {" "}
              {page.rows.length ? page.offset + 1 : 0}–
              {page.rows.length ? page.offset + page.rows.length : 0} of {page.total}{" "}
            </span>
            <button
              type="button"
              disabled={busy || page.nextOffset === null}
              onClick={() => {
                if (page.nextOffset !== null) void load(applied, page.nextOffset);
              }}
            >
              Next page
            </button>
          </nav>
          {props.onSave && (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void action(
                  (signal) =>
                    props.onSave?.(applied, page.report.inputHash, signal) ?? Promise.resolve(),
                )
              }
            >
              Save report and definition
            </button>
          )}
          {props.onExport && (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void action(
                  (signal) =>
                    props.onExport?.(applied, page.report.inputHash, signal) ?? Promise.resolve(),
                )
              }
            >
              Export masked report
            </button>
          )}
          {detail && (
            <section aria-label="Page detail">
              <h3 ref={detailHeading} tabIndex={-1}>
                {detail.pageId}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setDetail(null);
                  selectedButton.current?.focus();
                }}
              >
                Close page detail
              </button>
              <h4>Baseline</h4>
              <Period period={detail.baseline} />
              <h4>Current</h4>
              <Period period={detail.current} />
              {props.diagnostics?.map((tool) => (
                <button
                  key={tool.id}
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void action(async (signal) => {
                      const result = await tool.inspect(detail.pageId, signal);
                      signal.throwIfAborted();
                      return result;
                    })
                  }
                >
                  {tool.label}
                </button>
              ))}
            </section>
          )}
        </>
      )}
    </section>
  );
}
