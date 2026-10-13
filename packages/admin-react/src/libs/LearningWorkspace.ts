import { createElement as h, useEffect, useRef, useState } from "react";
import type { ChangeEvent, ReactElement } from "react";
import { importLearningEvidence } from "@croco/admin-core";
import type {
  EvidenceRef,
  LearningHypothesis,
  LearningMutation,
  LearningQuery,
  LearningRecord,
  LearningScope,
  LearningView,
} from "@croco/admin-core";

export type LearningWorkspaceState =
  | Readonly<{ kind: "loading" }>
  | Readonly<{ kind: "denied" | "error"; message: string }>
  | Readonly<{ kind: "ready"; draft: LearningRecord }>;
/** Callbacks are authenticated server endpoints for the same LearningRegistry service. */
export type LearningWorkspaceProps = Readonly<{
  scope: LearningScope;
  /** Host auth/privacy epoch. A change discards old drafts, exports and in-flight responses. */
  accessRevision: string;
  state: LearningWorkspaceState;
  canWrite: boolean;
  canExport: boolean;
  onSave(command: LearningMutation): Promise<LearningView>;
  onRead(id: string): Promise<LearningView>;
  onSearch(
    query: LearningQuery,
  ): Promise<Readonly<{ rows: readonly LearningView[]; nextAfter?: string }>>;
  onHistory(
    id: string,
    before?: number,
  ): Promise<
    readonly Readonly<{ view: LearningView; actor: string; reason: string; at: string }>[]
  >;
  onExport(id: string): Promise<LearningView>;
  onCopyDraft(id: string): Promise<LearningRecord>;
  /** Only provided by hosts with an actual local experiment-draft capability. Never runs an experiment. */
  onCreateExperimentDraft?(view: LearningView): Promise<void>;
}>;
function message(error: unknown): string {
  if (error instanceof Error && "code" in error && typeof error.code === "string")
    return error.code;
  return "Learning operation failed. The local draft is retained.";
}
function editable(view: LearningView): LearningRecord | undefined {
  if (!view.isComplete) return undefined;
  const fields = [
    "question",
    "desiredOutcome",
    "facts",
    "hypotheses",
    "evidenceRefs",
    "nextActions",
    "owner",
    "status",
    "tags",
  ];
  if (!fields.every((field) => Object.hasOwn(view.content, field))) return undefined;
  return {
    ...view.content,
    id: view.id,
    scope: view.scope,
    revision: view.revision,
  } as LearningRecord;
}
export function LearningWorkspace(props: LearningWorkspaceProps): ReactElement {
  if (props.state.kind !== "ready")
    return h(
      "section",
      { "aria-label": "Learning workspace" },
      h("h2", null, "Learning workspace"),
      h(
        "p",
        { role: props.state.kind === "loading" ? "status" : "alert" },
        props.state.kind === "loading" ? "Loading learning records…" : props.state.message,
      ),
    );
  const initial = props.state.draft;
  if (
    (["appId", "environment", "tenantId"] as const).some(
      (key) => props.scope[key] !== initial.scope[key],
    )
  )
    return h("p", { role: "alert" }, "Learning scope changed. Reload the workspace.");
  return h(Workspace, {
    key: JSON.stringify([
      props.scope.appId,
      props.scope.environment,
      props.scope.tenantId,
      props.accessRevision,
      props.state.draft.id,
    ]),
    props,
    initial: props.state.draft,
  });
}
function Workspace({
  props,
  initial,
}: {
  props: LearningWorkspaceProps;
  initial: LearningRecord;
}): ReactElement {
  const [draft, setDraft] = useState(initial);
  const [baseline, setBaseline] = useState(initial.revision);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [pending, setPending] = useState(false);
  const [latest, setLatest] = useState<LearningView>();
  const [evidence, setEvidence] = useState<LearningView["evidence"]>([]);
  const [results, setResults] = useState<readonly LearningView[]>([]);
  const [nextAfter, setNextAfter] = useState<string>();
  const [search, setSearch] = useState("");
  const [tagKind, setTagKind] = useState<"action" | "target" | "metric">("action");
  const [tag, setTag] = useState("");
  const [history, setHistory] = useState<Awaited<ReturnType<LearningWorkspaceProps["onHistory"]>>>(
    [],
  );
  const [exported, setExported] = useState<LearningView>();
  const [importText, setImportText] = useState("");
  const busy = useRef(false);
  const searchEpoch = useRef(0);
  const live = useRef(true);
  const attempt = useRef<{ fingerprint: string; key: string } | undefined>(undefined);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  const run = async (action: () => Promise<void>): Promise<void> => {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError(undefined);
    setNotice(undefined);
    // Never retain an export across an operation; each export reauthorizes current evidence.
    setExported(undefined);
    try {
      await action();
    } catch (failure) {
      if (live.current) setError(message(failure));
    } finally {
      busy.current = false;
      if (live.current) setPending(false);
    }
  };
  const save = async (): Promise<void> =>
    run(async () => {
      const payload = {
        record: {
          ...draft,
          revision: baseline,
          facts: draft.facts.filter((value) => value.trim()),
          nextActions: draft.nextActions.filter((value) => value.trim()),
          tags: {
            action: draft.tags.action.filter((value) => value.trim()),
            target: draft.tags.target.filter((value) => value.trim()),
            metric: draft.tags.metric.filter((value) => value.trim()),
          },
          hypotheses: draft.hypotheses.map((hypothesis) => ({
            ...hypothesis,
            supportRefs: hypothesis.supportRefs.filter((value) => value.trim()),
          })),
        },
        expectedRevision: baseline,
        reason,
      };
      const fingerprint = JSON.stringify(payload);
      const command =
        attempt.current?.fingerprint === fingerprint
          ? attempt.current
          : { fingerprint, key: crypto.randomUUID() };
      attempt.current = command;
      const view = await props.onSave({ ...payload, idempotencyKey: command.key });
      if (!live.current) return;
      const saved = editable(view);
      if (saved) {
        setDraft(saved);
        setBaseline(saved.revision);
      } else {
        // A successful save can return a source-redacted view. Retain the submitted document.
        setDraft({ ...payload.record, revision: view.revision });
        setBaseline(view.revision);
      }
      setEvidence(view.evidence);
      setLatest(undefined);
      setReason("");
      attempt.current = undefined;
      setNotice(
        `Saved revision ${view.revision}. ${view.hasLearning ? "Learning is recorded." : "No learning has been recorded."}`,
      );
    });
  const field = (
    label: string,
    value: string,
    update: (value: string) => void,
    required = false,
  ): ReactElement =>
    h(
      "label",
      { style: { display: "block", marginBlock: "0.75rem" } },
      label,
      h("textarea", {
        "aria-label": label,
        value,
        required,
        maxLength: 4000,
        rows: 2,
        style: { display: "block", width: "100%", boxSizing: "border-box" },
        onChange: (event: ChangeEvent<HTMLTextAreaElement>) => update(event.target.value),
      }),
    );
  const list = (label: string, key: "facts" | "nextActions"): ReactElement =>
    field(label, draft[key].join("\n"), (value) =>
      setDraft({ ...draft, [key]: value.split("\n") }),
    );
  const options = (
    label: string,
    value: string,
    choices: readonly string[],
    update: (value: string) => void,
  ): ReactElement =>
    h(
      "label",
      null,
      label,
      h(
        "select",
        {
          "aria-label": label,
          value,
          onChange: (event: ChangeEvent<HTMLSelectElement>) => update(event.target.value),
        },
        choices.map((choice) => h("option", { key: choice }, choice)),
      ),
    );
  const hypothesis = (item: LearningHypothesis, index: number): ReactElement => {
    const update = (patch: Partial<LearningHypothesis>): void =>
      setDraft({
        ...draft,
        hypotheses: draft.hypotheses.map((value, i) =>
          i === index ? { ...value, ...patch } : value,
        ),
      });
    return h(
      "fieldset",
      { key: index },
      h("legend", null, `Hypothesis ${index + 1}`),
      field(`Hypothesis ${index + 1} text`, item.text, (value) => update({ text: value }), true),
      options(
        `Hypothesis ${index + 1} state`,
        item.state,
        ["new", "checking", "supported", "refuted", "inconclusive", "unknown"],
        (value) => update({ state: value as LearningHypothesis["state"] }),
      ),
      field(
        `Hypothesis ${index + 1} limitations`,
        item.limitations,
        (value) => update({ limitations: value }),
        ["supported", "refuted"].includes(item.state),
      ),
      field(`Hypothesis ${index + 1} support references`, item.supportRefs.join("\n"), (value) =>
        update({ supportRefs: value.split("\n") }),
      ),
      h(
        "p",
        null,
        "Use the evidence identity shown below. Supported/refuted does not imply proven causality.",
      ),
      h(
        "button",
        {
          type: "button",
          onClick: () =>
            setDraft({ ...draft, hypotheses: draft.hypotheses.filter((_, i) => i !== index) }),
        },
        `Remove hypothesis ${index + 1}`,
      ),
    );
  };
  const reference = (ref: EvidenceRef, index: number): ReactElement => {
    const update = (patch: Partial<EvidenceRef>): void =>
      setDraft({
        ...draft,
        evidenceRefs: draft.evidenceRefs.map((value, i) =>
          i === index ? { ...value, ...patch } : value,
        ),
      });
    return h(
      "fieldset",
      { key: index },
      h("legend", null, `Evidence ${index + 1}`),
      ...(["source", "id", "version"] as const).map((key) =>
        field(`Evidence ${index + 1} ${key}`, ref[key], (value) => update({ [key]: value }), true),
      ),
      field(
        `Evidence ${index + 1} from`,
        ref.observedWindow.from,
        (value) => update({ observedWindow: { ...ref.observedWindow, from: value } }),
        true,
      ),
      field(
        `Evidence ${index + 1} to`,
        ref.observedWindow.to,
        (value) => update({ observedWindow: { ...ref.observedWindow, to: value } }),
        true,
      ),
      field(`Evidence ${index + 1} URL`, ref.url ?? "", (value) =>
        update({ url: value || undefined }),
      ),
      h(
        "code",
        { style: { overflowWrap: "anywhere" } },
        JSON.stringify([ref.source, ref.id, ref.version]),
      ),
      h(
        "button",
        {
          type: "button",
          onClick: () =>
            setDraft({ ...draft, evidenceRefs: draft.evidenceRefs.filter((_, i) => i !== index) }),
        },
        `Remove evidence ${index + 1}`,
      ),
    );
  };
  const find = async (after?: string): Promise<void> =>
    run(async () => {
      const epoch = searchEpoch.current;
      const page = await props.onSearch({
        text: search,
        limit: 20,
        after,
        ...(tag ? { tag: { kind: tagKind, value: tag } } : {}),
      });
      if (live.current && epoch === searchEpoch.current) {
        setResults(page.rows);
        setNextAfter(page.nextAfter);
      }
    });
  return h(
    "section",
    {
      "aria-label": "Learning workspace",
      "aria-busy": pending,
      style: {
        maxWidth: "56rem",
        padding: "1rem",
        overflowWrap: "anywhere",
        boxSizing: "border-box",
      },
    },
    h("h2", null, "Learning workspace"),
    h("p", null, `${props.scope.appId} / ${props.scope.environment} / ${props.scope.tenantId}`),
    h(
      "p",
      null,
      "Keep observed facts, hypotheses and deployment decisions separate. Unknown and inconclusive are valid outcomes.",
    ),
    h(
      "form",
      {
        onSubmit: (event) => {
          event.preventDefault();
          void save();
        },
      },
      h(
        "fieldset",
        { disabled: pending || !props.canWrite },
        h("legend", null, `Record ${draft.id} · revision ${baseline}`),
        field("Question", draft.question, (value) => setDraft({ ...draft, question: value }), true),
        field("Desired outcome", draft.desiredOutcome, (value) =>
          setDraft({ ...draft, desiredOutcome: value }),
        ),
        list("Observed facts (one per line)", "facts"),
        ...draft.hypotheses.map(hypothesis),
        h(
          "button",
          {
            type: "button",
            onClick: () =>
              setDraft({
                ...draft,
                hypotheses: [
                  ...draft.hypotheses,
                  { text: "", state: "new", supportRefs: [], limitations: "" },
                ],
              }),
          },
          "Add hypothesis",
        ),
        ...draft.evidenceRefs.map(reference),
        h(
          "button",
          {
            type: "button",
            onClick: () =>
              setDraft({
                ...draft,
                evidenceRefs: [
                  ...draft.evidenceRefs,
                  { source: "", id: "", version: "", observedWindow: { from: "", to: "" } },
                ],
              }),
          },
          "Add evidence reference",
        ),
        field("Import aggregate evidence JSON", importText, setImportText),
        h(
          "button",
          {
            type: "button",
            onClick: () => {
              try {
                const ref = importLearningEvidence(importText);
                setDraft({ ...draft, evidenceRefs: [...draft.evidenceRefs, ref] });
                setImportText("");
              } catch (failure) {
                setError(message(failure));
              }
            },
          },
          "Import evidence into draft",
        ),
        field("Decision", draft.decision?.text ?? "", (value) =>
          setDraft({ ...draft, decision: value ? { ...draft.decision, text: value } : undefined }),
        ),
        list("Next actions (one per line)", "nextActions"),
        field("Owner", draft.owner, (value) => setDraft({ ...draft, owner: value }), true),
        ...(["action", "target", "metric"] as const).map((kind) =>
          field(`${kind} tags (one per line)`, draft.tags[kind].join("\n"), (value) =>
            setDraft({
              ...draft,
              tags: { ...draft.tags, [kind]: value.split("\n") },
            }),
          ),
        ),
        options("Record status", draft.status, ["draft", "reviewed", "archived"], (value) =>
          setDraft({ ...draft, status: value as LearningRecord["status"] }),
        ),
        field("Change reason", reason, setReason, true),
        h("button", { type: "submit", disabled: !reason.trim() }, "Save record"),
      ),
    ),
    notice ? h("p", { role: "status" }, notice) : null,
    error ? h("p", { role: "alert" }, error) : null,
    pending ? h("p", { role: "status" }, "Working…") : null,
    h(
      "button",
      {
        type: "button",
        disabled: pending || baseline === 0,
        onClick: () =>
          void run(async () => {
            const view = await props.onRead(draft.id);
            if (live.current) {
              setLatest(view);
              setEvidence(view.evidence);
            }
          }),
      },
      "Load latest without replacing draft",
    ),
    latest
      ? h(
          "section",
          { "aria-label": "Latest saved revision" },
          h("h3", null, `Latest revision ${latest.revision}`),
          h("pre", { style: { whiteSpace: "pre-wrap" } }, JSON.stringify(latest.content, null, 2)),
          editable(latest)
            ? h(
                "button",
                {
                  type: "button",
                  disabled: pending,
                  onClick: () => {
                    const value = editable(latest);
                    if (value) {
                      setDraft(value);
                      setBaseline(value.revision);
                      setLatest(undefined);
                      setHistory([]);
                      setReason("");
                      setImportText("");
                      attempt.current = undefined;
                    }
                  },
                },
                "Replace draft with latest",
              )
            : h(
                "p",
                { role: "status" },
                "Some stored content is unavailable. This view cannot replace the draft.",
              ),
        )
      : null,
    h(
      "ul",
      { "aria-label": "Current evidence availability" },
      evidence.map((item, index) =>
        h(
          "li",
          { key: index },
          `${item.reference.source} / ${item.reference.id} / ${item.reference.version} · ${item.accessState}`,
        ),
      ),
    ),
    h(
      "section",
      { "aria-label": "Search learning records" },
      h("h3", null, "Find previous learning"),
      field("Search text", search, (value) => {
        setSearch(value);
        searchEpoch.current += 1;
        setResults([]);
        setNextAfter(undefined);
      }),
      options("Search tag kind", tagKind, ["action", "target", "metric"], (value) => {
        setTagKind(value as typeof tagKind);
        searchEpoch.current += 1;
        setResults([]);
        setNextAfter(undefined);
      }),
      field("Search tag", tag, (value) => {
        setTag(value);
        searchEpoch.current += 1;
        setResults([]);
        setNextAfter(undefined);
      }),
      h("button", { type: "button", disabled: pending, onClick: () => void find() }, "Search"),
      results.length
        ? h(
            "ul",
            null,
            results.map((view) =>
              h(
                "li",
                { key: view.id },
                `${view.content.question ?? view.id} · revision ${view.revision}`,
                h(
                  "button",
                  {
                    type: "button",
                    disabled: pending,
                    onClick: () =>
                      void run(async () => {
                        const current = await props.onRead(view.id);
                        if (live.current) {
                          setLatest(current);
                          setEvidence(current.evidence);
                        }
                      }),
                  },
                  `Inspect ${view.id}`,
                ),
                h(
                  "button",
                  {
                    type: "button",
                    disabled: pending || !props.canWrite || !props.canExport,
                    onClick: () =>
                      void run(async () => {
                        const copied = await props.onCopyDraft(view.id);
                        if (live.current) {
                          setDraft(copied);
                          setBaseline(0);
                          setLatest(undefined);
                          setEvidence([]);
                          setHistory([]);
                          attempt.current = undefined;
                        }
                      }),
                  },
                  `Copy ${view.id} as new draft`,
                ),
                props.onCreateExperimentDraft
                  ? h(
                      "button",
                      {
                        type: "button",
                        disabled: pending || !props.canExport,
                        onClick: () =>
                          void run(async () => {
                            const current = await props.onExport(view.id);
                            if (!live.current) return;
                            await props.onCreateExperimentDraft?.(current);
                          }),
                      },
                      `Create local experiment draft from ${view.id}`,
                    )
                  : null,
              ),
            ),
          )
        : h("p", null, "No records in this search page."),
      nextAfter
        ? h(
            "button",
            { type: "button", disabled: pending, onClick: () => void find(nextAfter) },
            "Next search page",
          )
        : null,
    ),
    h(
      "button",
      {
        type: "button",
        disabled: pending || baseline === 0,
        onClick: () =>
          void run(async () => {
            const versions = await props.onHistory(draft.id);
            if (live.current) setHistory(versions);
          }),
      },
      "Read revision history",
    ),
    history.length
      ? h(
          "ol",
          { "aria-label": "Revision history" },
          history.map((item) =>
            h(
              "li",
              { key: item.view.revision },
              `Revision ${item.view.revision} · ${item.actor} · ${item.reason}`,
              h(
                "pre",
                { style: { whiteSpace: "pre-wrap" } },
                JSON.stringify(item.view.content, null, 2),
              ),
            ),
          ),
        )
      : null,
    history.length > 0 && history.at(-1)?.view.revision !== 1
      ? h(
          "button",
          {
            type: "button",
            disabled: pending,
            onClick: () =>
              void run(async () => {
                const versions = await props.onHistory(draft.id, history.at(-1)?.view.revision);
                if (live.current) setHistory([...history, ...versions]);
              }),
          },
          "Earlier revisions",
        )
      : null,
    props.canExport
      ? h(
          "button",
          {
            type: "button",
            disabled: pending || baseline === 0,
            onClick: () =>
              void run(async () => {
                const view = await props.onExport(draft.id);
                if (live.current) setExported(view);
              }),
          },
          "Export current authorized record",
        )
      : null,
    exported
      ? h(
          "pre",
          { "aria-label": "Authorized export", style: { whiteSpace: "pre-wrap" } },
          JSON.stringify(exported, null, 2),
        )
      : null,
  );
}
