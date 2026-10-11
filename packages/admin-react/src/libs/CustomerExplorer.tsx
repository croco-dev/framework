import * as React from "react";
import type { CSSProperties, ReactElement } from "react";
import { CustomerExplorerProblem } from "@croco/admin-core";
import type {
  ExplorerEventRef,
  ExplorerNote,
  ExplorerQueryDraft,
  ExplorerScope,
  ExplorerSubject,
  ExplorerTimeline,
  Sample,
} from "@croco/admin-core";

export type CustomerExplorerNote = ExplorerNote & {
  references: readonly { ref: ExplorerEventRef; status: "available" | "unavailable" }[];
};
export type CustomerExplorerOperations = {
  getSample(scope: ExplorerScope, id: string): Promise<Sample>;
  timeline(
    scope: ExplorerScope,
    sampleId: string,
    subject: ExplorerSubject,
    options: {
      limit: number;
      cursors?: Readonly<Record<string, string>>;
    },
  ): Promise<ExplorerTimeline>;
  notes(scope: ExplorerScope, sampleId: string): Promise<readonly CustomerExplorerNote[]>;
  saveNote(
    scope: ExplorerScope,
    sampleId: string,
    input: {
      id: string;
      subject: ExplorerSubject;
      kind: "fact" | "hypothesis";
      eventRefs: readonly ExplorerEventRef[];
      text: string;
      expectedRevision: number;
    },
  ): Promise<ExplorerNote>;
  exportDraft(
    scope: ExplorerScope,
    sampleId: string,
    conditions: ExplorerQueryDraft["conditions"],
  ): Promise<ExplorerQueryDraft>;
};
export type CustomerExplorerProps = {
  scope: ExplorerScope;
  sampleId: string;
  operations: CustomerExplorerOperations;
};

const panel: CSSProperties = {
  border: "1px solid #dbe2e8",
  borderRadius: 12,
  padding: 20,
  background: "#fff",
};
const row: CSSProperties = { display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" };
const eventKey = (ref: { source: string; eventId: string }) =>
  JSON.stringify([ref.source, ref.eventId]);
const subjectKey = (subject: ExplorerSubject) => JSON.stringify([subject.kind, subject.id]);
function occurrence(value: string): bigint {
  const fraction = (value.match(/\.(\d+)(?:Z|[+-]\d{2}:\d{2})$/)?.[1] ?? "").padEnd(6, "0");
  return BigInt(Date.parse(value)) * BigInt(1000) + BigInt(fraction.slice(3));
}
function problemCode(error: unknown): string {
  const code =
    typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
  return typeof code === "string" && /^customer-explorer\/[a-z-]+$/.test(code)
    ? code
    : "customer-explorer/operation-failed";
}
function Failure({ code, retry }: { code: string; retry: () => void }): ReactElement {
  return (
    <div role="alert" data-state={code === "customer-explorer/denied" ? "denied" : "error"}>
      <p>
        {code === "customer-explorer/denied"
          ? "Customer explorer access denied. Ask an administrator to restore access."
          : code === "customer-explorer/revision-conflict"
            ? "This note changed on the server. Retry reloads current notes; review the latest revision before editing again."
            : "Customer explorer could not complete this operation."}
      </p>
      <p>
        <code>{code}</code>
      </p>
      <button type="button" onClick={retry}>
        Retry
      </button>
    </div>
  );
}

/** Bind these callbacks to the authorized server service; credentials and actor stay on the server. */
export function CustomerExplorer(props: CustomerExplorerProps): ReactElement {
  return (
    <Workspace
      key={JSON.stringify([
        props.scope.appId,
        props.scope.environment,
        props.scope.tenantId,
        props.sampleId,
      ])}
      {...props}
    />
  );
}
function Workspace({ scope, sampleId, operations }: CustomerExplorerProps): ReactElement {
  const { appId, environment, tenantId } = scope;
  const [sample, setSample] = React.useState<Sample>();
  const [error, setError] = React.useState<string>();
  const [attempt, setAttempt] = React.useState(0);
  const [index, setIndex] = React.useState(0);
  const [visited, setVisited] = React.useState<readonly string[]>([]);
  React.useEffect(() => {
    let active = true;
    setError(undefined);
    setSample(undefined);
    void operations
      .getSample({ appId, environment, tenantId }, sampleId)
      .then((value) => {
        if (active) setSample(value);
      })
      .catch((reason) => {
        if (active) setError(problemCode(reason));
      });
    return () => {
      active = false;
    };
  }, [appId, environment, tenantId, sampleId, operations, attempt]);
  const candidate = sample?.sampledSubjects[index];
  return (
    <section
      aria-label="Customer explorer"
      style={{
        color: "#182936",
        background: "#f5f7f9",
        padding: 24,
        fontFamily: "system-ui, sans-serif",
        lineHeight: 1.5,
      }}
    >
      <header style={{ marginBottom: 24 }}>
        <p style={{ textTransform: "uppercase", letterSpacing: 2, fontSize: 12 }}>
          Customer research
        </p>
        <h1 style={{ margin: "8px 0", fontSize: 30 }}>Customer explorer</h1>
        <p>
          {scope.appId} / {scope.environment} / {scope.tenantId}
        </p>
      </header>
      {error ? (
        <Failure code={error} retry={() => setAttempt((n) => n + 1)} />
      ) : !sample ? (
        <p role="status" data-state="loading">
          Loading saved sample…
        </p>
      ) : (
        <>
          <section aria-label="Saved sample" style={{ ...panel, marginBottom: 20 }}>
            <h2>{sample.targetDefinition.description}</h2>
            <p>
              Definition {sample.targetDefinition.id} · revision {sample.targetDefinition.revision}{" "}
              · snapshot {sample.populationSnapshotId}
            </p>
            <p>
              Seed {sample.seed} · {sample.excludedN} excluded · expires {sample.expiresAt}
            </p>
            <div style={row}>
              {(["achiever", "comparison"] as const).map((group) => {
                const subjects = sample.sampledSubjects.filter((item) => item.group === group);
                return (
                  <span key={group}>
                    {group === "achiever" ? "Achievers" : "Prior-step comparison"}:{" "}
                    {subjects.filter((item) => visited.includes(subjectKey(item.subject))).length}/
                    {subjects.length} viewed this session
                  </span>
                );
              })}
            </div>
            <p style={{ fontSize: 13 }}>
              This fixed exploratory sample does not establish statistical representativeness.
            </p>
          </section>
          {!candidate ? (
            <p data-state="empty">No subjects in this sample.</p>
          ) : (
            <>
              <nav aria-label="Sample subjects" style={{ ...row, marginBottom: 20 }}>
                <button type="button" disabled={index === 0} onClick={() => setIndex((n) => n - 1)}>
                  Previous subject
                </button>
                <label>
                  Subject{" "}
                  <select
                    aria-label="Subject"
                    value={index}
                    onChange={(event) => setIndex(Number(event.target.value))}
                  >
                    {sample.sampledSubjects.map((item, position) => (
                      <option key={subjectKey(item.subject)} value={position}>
                        {position + 1}. {item.subject.id} · {item.group}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  disabled={index + 1 === sample.sampledSubjects.length}
                  onClick={() => setIndex((n) => n + 1)}
                >
                  Next subject
                </button>
                <span>
                  {index + 1} of {sample.sampledSubjects.length}
                </span>
              </nav>
              <SubjectWorkspace
                key={subjectKey(candidate.subject)}
                scope={scope}
                sampleId={sampleId}
                operations={operations}
                candidate={candidate}
                onViewed={() =>
                  setVisited((previous) =>
                    previous.includes(subjectKey(candidate.subject))
                      ? previous
                      : [...previous, subjectKey(candidate.subject)],
                  )
                }
              />
            </>
          )}
        </>
      )}
    </section>
  );
}

function SubjectWorkspace({
  scope,
  sampleId,
  operations,
  candidate,
  onViewed,
}: CustomerExplorerProps & {
  candidate: Sample["sampledSubjects"][number];
  onViewed: () => void;
}): ReactElement {
  const { appId, environment, tenantId } = scope;
  const { kind: subjectKind, id: subjectId } = candidate.subject;
  const [timeline, setTimeline] = React.useState<ExplorerTimeline>();
  const [notes, setNotes] = React.useState<readonly CustomerExplorerNote[]>([]);
  const [error, setError] = React.useState<string>();
  const [pending, setPending] = React.useState(false);
  const [attempt, setAttempt] = React.useState(0);
  const [sourceFilter, setSourceFilter] = React.useState("");
  const [kindFilter, setKindFilter] = React.useState("");
  const [phaseFilter, setPhaseFilter] = React.useState("");
  const [selected, setSelected] = React.useState<readonly ExplorerEventRef[]>([]);
  const [text, setText] = React.useState("");
  const [kind, setKind] = React.useState<"fact" | "hypothesis">("fact");
  const [editing, setEditing] = React.useState<ExplorerNote>();
  const [feedback, setFeedback] = React.useState("");
  const [draft, setDraft] = React.useState<ExplorerQueryDraft>();
  const active = React.useRef(true);
  const viewed = React.useRef(onViewed);
  viewed.current = onViewed;
  React.useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  React.useEffect(() => {
    let current = true;
    setTimeline(undefined);
    setError(undefined);
    setNotes([]);
    setSelected([]);
    setDraft(undefined);
    setEditing(undefined);
    setText("");
    const readScope = { appId, environment, tenantId };
    const readSubject = { kind: subjectKind, id: subjectId };
    void Promise.all([
      operations.timeline(readScope, sampleId, readSubject, { limit: 50 }),
      operations.notes(readScope, sampleId),
    ])
      .then(([result, loadedNotes]) => {
        if (!current) return;
        setTimeline(result);
        setNotes(
          loadedNotes.filter((note) => subjectKey(note.subject) === subjectKey(readSubject)),
        );
        viewed.current();
      })
      .catch((reason) => {
        if (current) setError(problemCode(reason));
      });
    return () => {
      current = false;
    };
  }, [operations, appId, environment, tenantId, sampleId, subjectKind, subjectId, attempt]);
  async function run(operation: () => Promise<void>) {
    setPending(true);
    setError(undefined);
    setFeedback("");
    try {
      await operation();
    } catch (reason) {
      if (active.current) setError(problemCode(reason));
    } finally {
      if (active.current) setPending(false);
    }
  }
  async function nextPage(source: string, cursor: string) {
    const page = await operations.timeline(scope, sampleId, candidate.subject, {
      limit: 50,
      cursors: { [source]: cursor },
    });
    if (!active.current) return;
    const sourceStatus = page.sources.find((value) => value.source === source);
    if (!sourceStatus) {
      throw new CustomerExplorerProblem(
        "source-failed",
        "Timeline page omitted the requested source status",
      );
    }
    setTimeline((previous) => {
      if (!previous) return previous;
      const items = new Map(previous.items.map((item) => [eventKey(item), item]));
      for (const item of page.items.filter((item) => item.source === source))
        items.set(eventKey(item), item);
      const nextCursors = { ...previous.nextCursors };
      delete nextCursors[source];
      if (page.nextCursors[source]) nextCursors[source] = page.nextCursors[source];
      return {
        items: [...items.values()].sort(
          (a, b) =>
            Number(occurrence(a.occurredAt) - occurrence(b.occurredAt)) ||
            (a.source < b.source
              ? -1
              : a.source > b.source
                ? 1
                : a.eventId < b.eventId
                  ? -1
                  : a.eventId > b.eventId
                    ? 1
                    : 0),
        ),
        sources: previous.sources.map((status) =>
          status.source === source ? sourceStatus : status,
        ),
        nextCursors,
      };
    });
  }
  const visible =
    timeline?.items.filter(
      (item) =>
        (!sourceFilter || sourceFilter === item.source) &&
        (!kindFilter || kindFilter === item.kind) &&
        (!phaseFilter || phaseFilter === item.phase),
    ) ?? [];
  const partial = timeline?.sources.some(
    (source) => source.status !== "complete" || source.truncated,
  );
  return (
    <div aria-busy={pending}>
      <div style={{ ...row, justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0 }}>{candidate.subject.id}</h2>
          <p>
            {candidate.subject.kind} ·{" "}
            {candidate.group === "achiever" ? "Achiever" : "Prior-step comparison"} · anchor{" "}
            {candidate.anchorAt}
          </p>
        </div>
        <button type="button" disabled={pending} onClick={() => setAttempt((n) => n + 1)}>
          Refresh subject
        </button>
      </div>
      {error && <Failure code={error} retry={() => setAttempt((n) => n + 1)} />}
      {!timeline && !error ? (
        <p role="status" data-state="loading">
          Loading subject timeline…
        </p>
      ) : (
        timeline && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))",
              gap: 20,
            }}
          >
            <section
              aria-label="Timeline"
              style={panel}
              data-state={partial ? "partial" : timeline.items.length === 0 ? "empty" : "ready"}
            >
              <h3>Original events</h3>
              <p style={{ fontSize: 13 }}>
                Occurred time, then source and event ID. Simultaneous events are ordered for
                reading, not as evidence of causality.
              </p>
              <p>Up to 50 events per source per page.</p>
              <ul aria-label="Source completeness">
                {timeline.sources.map((source) => (
                  <li key={source.source}>
                    {source.source}: {source.status}
                    {source.truncated ? " · truncated" : ""}
                    {timeline.nextCursors[source.source] && (
                      <>
                        {" "}
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => {
                            const cursor = timeline.nextCursors[source.source];
                            if (cursor) void run(() => nextPage(source.source, cursor));
                          }}
                        >
                          Load more {source.source}
                        </button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
              {partial && (
                <p role="status">
                  Source coverage is incomplete. Refresh to retry failed or denied sources; load
                  more for truncated sources.
                </p>
              )}
              <div style={row}>
                <label>
                  Source{" "}
                  <select
                    aria-label="Source filter"
                    value={sourceFilter}
                    onChange={(event) => setSourceFilter(event.target.value)}
                  >
                    <option value="">All sources</option>
                    {timeline.sources.map((source) => (
                      <option key={source.source}>{source.source}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Meaning{" "}
                  <select
                    aria-label="Meaning filter"
                    value={kindFilter}
                    onChange={(event) => setKindFilter(event.target.value)}
                  >
                    <option value="">All meanings</option>
                    {[...new Set(timeline.items.map((item) => item.kind))].sort().map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Anchor{" "}
                  <select
                    aria-label="Anchor filter"
                    value={phaseFilter}
                    onChange={(event) => setPhaseFilter(event.target.value)}
                  >
                    <option value="">All times</option>
                    <option value="before">Before</option>
                    <option value="anchor">At anchor</option>
                    <option value="after">After</option>
                  </select>
                </label>
              </div>
              {visible.length === 0 && (
                <p>
                  {timeline.items.length === 0
                    ? "No events returned for this subject window. Check source coverage above."
                    : "No loaded events match these filters."}
                </p>
              )}
              <ol style={{ paddingLeft: 24 }}>
                {visible.map((item, position) => {
                  const previous = visible[position - 1];
                  const gap = previous
                    ? Number(occurrence(item.occurredAt) - occurrence(previous.occurredAt)) / 1000
                    : undefined;
                  const reference = {
                    source: item.source,
                    eventId: item.eventId,
                    subject: item.subject,
                  };
                  return (
                    <li
                      key={eventKey(item)}
                      style={{ padding: "14px 0", borderBottom: "1px solid #e5e9ed" }}
                    >
                      {(gap === undefined || gap >= 30 * 60 * 1000) && (
                        <p style={{ fontSize: 12, color: "#52616f" }}>
                          Session group
                          {gap !== undefined
                            ? ` · ${Math.round(gap / 60000)} min gap`
                            : " · loaded events"}
                        </p>
                      )}
                      {gap !== undefined && gap < 30 * 60 * 1000 && (
                        <small>
                          {gap === 0
                            ? "Simultaneous with previous event"
                            : gap < 1000
                              ? `${gap} ms since previous loaded event`
                              : `${Math.round(gap / 1000)} sec since previous loaded event`}
                        </small>
                      )}
                      <div>
                        <label>
                          <input
                            type="checkbox"
                            aria-label={`Select ${item.source}/${item.eventId}`}
                            checked={selected.some((ref) => eventKey(ref) === eventKey(item))}
                            disabled={pending}
                            onChange={(event) => {
                              setDraft(undefined);
                              setSelected((previousRefs) =>
                                event.target.checked
                                  ? [...previousRefs, reference]
                                  : previousRefs.filter((ref) => eventKey(ref) !== eventKey(item)),
                              );
                            }}
                          />{" "}
                          <strong>{item.kind}</strong>
                        </label>{" "}
                        <span>
                          {item.phase === "anchor"
                            ? "At anchor"
                            : item.phase === "before"
                              ? "Before anchor"
                              : "After anchor"}
                        </span>
                      </div>
                      <time dateTime={item.occurredAt}>{item.occurredAt}</time>
                      <div>
                        <small>
                          {item.source} / {item.eventId} · {item.completeness} · observed{" "}
                          {item.observedAt}
                        </small>
                      </div>
                      {item.objectRef && <p>{item.objectRef}</p>}
                      <dl>
                        {Object.entries(item.safeProperties).map(([name, value]) => (
                          <div key={name}>
                            <dt style={{ display: "inline", fontWeight: 600 }}>{name}: </dt>
                            <dd style={{ display: "inline", margin: 0 }}>{String(value)}</dd>
                          </div>
                        ))}
                      </dl>
                    </li>
                  );
                })}
              </ol>
              <p style={{ fontSize: 12 }}>
                Session groups use a 30-minute gap between loaded, filtered events. Incomplete
                sources can hide intervening events.
              </p>
            </section>
            <aside style={panel} aria-label="Observations">
              <h3>Observations & hypotheses</h3>
              <p>Link selected events to what you observed. Keep explanations as hypotheses.</p>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void run(async () => {
                    const saved = await operations.saveNote(scope, sampleId, {
                      id: editing?.id ?? globalThis.crypto.randomUUID(),
                      subject: candidate.subject,
                      kind,
                      eventRefs: selected,
                      text,
                      expectedRevision: editing?.revision ?? 0,
                    });
                    if (!active.current) return;
                    setEditing(saved);
                    setText(saved.text);
                    setSelected(saved.eventRefs);
                    setFeedback(`Note saved · revision ${saved.revision}. Refreshing evidence…`);
                    const refreshed = await operations.notes(scope, sampleId);
                    if (!active.current) return;
                    setNotes(
                      refreshed.filter(
                        (note) => subjectKey(note.subject) === subjectKey(candidate.subject),
                      ),
                    );
                    setEditing(undefined);
                    setText("");
                    setSelected([]);
                    setDraft(undefined);
                    setFeedback(`Note saved · revision ${saved.revision}`);
                  });
                }}
              >
                <fieldset
                  disabled={pending}
                  style={{ border: 0, padding: 0, display: "grid", gap: 12 }}
                >
                  <legend>
                    {editing ? `Edit note · expected revision ${editing.revision}` : "New note"}
                  </legend>
                  <label>
                    Note kind{" "}
                    <select
                      aria-label="Note kind"
                      value={kind}
                      onChange={(event) => setKind(event.target.value as "fact" | "hypothesis")}
                    >
                      <option value="fact">Fact</option>
                      <option value="hypothesis">Hypothesis</option>
                    </select>
                  </label>
                  <label>
                    Observation{" "}
                    <textarea
                      aria-label="Observation"
                      required
                      maxLength={4000}
                      value={text}
                      onChange={(event) => setText(event.target.value)}
                      style={{
                        display: "block",
                        boxSizing: "border-box",
                        width: "100%",
                        minHeight: 110,
                      }}
                    />
                  </label>
                  <p>
                    {selected.length} linked event{selected.length === 1 ? "" : "s"}
                  </p>
                  <ul aria-label="Linked events">
                    {selected.map((ref) => (
                      <li key={eventKey(ref)}>
                        {ref.source}/{ref.eventId}{" "}
                        <button
                          type="button"
                          onClick={() => {
                            setSelected((refs) =>
                              refs.filter((value) => eventKey(value) !== eventKey(ref)),
                            );
                            setDraft(undefined);
                          }}
                        >
                          Remove reference {ref.source}/{ref.eventId}
                        </button>
                      </li>
                    ))}
                  </ul>
                  <button type="submit" disabled={!text.trim() || selected.length === 0}>
                    {editing ? "Save revision" : "Save note"}
                  </button>
                  {editing && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(undefined);
                        setText("");
                        setSelected([]);
                      }}
                    >
                      Cancel edit
                    </button>
                  )}
                </fieldset>
              </form>
              {feedback && <p role="status">{feedback}</p>}
              <ul style={{ paddingLeft: 20 }}>
                {notes.map((note) => (
                  <li key={note.id} style={{ marginBlock: 20 }}>
                    <strong>{note.kind === "fact" ? "Fact" : "Hypothesis"}</strong>
                    <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{note.text}</p>
                    <small>
                      {note.author} · revision {note.revision} · {note.updatedAt}
                    </small>
                    <ul>
                      {note.references.map(({ ref, status }) => (
                        <li key={eventKey(ref)}>
                          {ref.source}/{ref.eventId} · {status}
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        setEditing(note);
                        setKind(note.kind);
                        setText(note.text);
                        setSelected(note.eventRefs);
                        setDraft(undefined);
                        setFeedback("");
                      }}
                    >
                      Edit note
                    </button>
                  </li>
                ))}
              </ul>
              <hr />
              <h3>Compare in aggregate</h3>
              <p>Export selected event conditions as a typed query definition.</p>
              <button
                type="button"
                disabled={
                  pending ||
                  selected.length === 0 ||
                  selected.some(
                    (ref) => !timeline.items.some((item) => eventKey(item) === eventKey(ref)),
                  )
                }
                onClick={() =>
                  void run(async () => {
                    const conditions = timeline.items
                      .filter((item) => selected.some((ref) => eventKey(ref) === eventKey(item)))
                      .map((item) => ({ kind: item.kind, source: item.source, phase: item.phase }));
                    const result = await operations.exportDraft(scope, sampleId, conditions);
                    if (active.current) setDraft(result);
                  })
                }
              >
                Prepare query draft
              </button>
              {draft && (
                <p>
                  <a
                    download={`customer-explorer-${sampleId}.json`}
                    href={`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(draft, null, 2))}`}
                  >
                    Download query definition
                  </a>
                </p>
              )}
            </aside>
          </div>
        )
      )}
    </div>
  );
}
