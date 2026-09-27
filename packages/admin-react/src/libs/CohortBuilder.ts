import { createElement as h, useEffect, useRef, useState } from "react";
import type { ChangeEvent, ReactElement } from "react";
import type {
  CohortDefinition,
  CohortPredicate,
  CohortRegistration,
  CohortScalar,
} from "@croco/cohort-core";
import type {
  CohortBuilderState,
  CohortPreviewRequest,
  CohortPublishRequest,
} from "@croco/admin-core";

export type CohortBuilderProps = Readonly<{
  definition: CohortDefinition;
  registration: CohortRegistration;
  state: CohortBuilderState;
  actor: string;
  asOf: string;
  canPreview: boolean;
  canPublish: boolean;
  onPreview(request: CohortPreviewRequest): Promise<void>;
  onPublish(request: CohortPublishRequest): Promise<void>;
}>;
const input = (
  label: string,
  value: string | number,
  update: (value: string) => void,
  type = "text",
) =>
  h(
    "label",
    { style: { display: "block", margin: "0.5rem 0" } },
    label,
    h("input", {
      "aria-label": label,
      type,
      value,
      required: true,
      onChange: (e: ChangeEvent<HTMLInputElement>) => update(e.target.value),
    }),
  );
const select = (
  label: string,
  value: string,
  options: readonly string[],
  update: (value: string) => void,
) =>
  h(
    "label",
    { style: { display: "block", margin: "0.5rem 0" } },
    label,
    h(
      "select",
      {
        "aria-label": label,
        value,
        onChange: (e: ChangeEvent<HTMLSelectElement>) => update(e.target.value),
      },
      options.map((option) => h("option", { key: option, value: option }, option)),
    ),
  );
type PredicateEditorProps = {
  node: CohortPredicate;
  registration: CohortRegistration;
  update(node: CohortPredicate): void;
};
function PredicateEditor(props: PredicateEditorProps): ReactElement {
  return h(
    "div",
    null,
    h(PredicateInputs, props),
    h(
      "button",
      {
        type: "button",
        onClick: () =>
          props.update(
            props.node.kind === "not" ? props.node.child : { kind: "not", child: props.node },
          ),
      },
      props.node.kind === "not" ? "Remove NOT" : "Apply NOT",
    ),
    h(
      "button",
      { type: "button", onClick: () => props.update({ kind: "all", children: [props.node] }) },
      "Wrap in group",
    ),
  );
}
function PredicateInputs({
  node,
  registration,
  update,
}: {
  node: CohortPredicate;
  registration: CohortRegistration;
  update(node: CohortPredicate): void;
}): ReactElement {
  if ("children" in node)
    return h(
      "fieldset",
      null,
      h("legend", null, "Condition group"),
      select("Combine conditions", node.kind, ["all", "any"], (kind) =>
        update({ ...node, kind: kind as "all" | "any" }),
      ),
      node.children.map((child, index) =>
        h(
          "div",
          { key: index },
          h(PredicateEditor, {
            node: child,
            registration,
            update: (next) =>
              update({
                ...node,
                children: node.children.map((entry, position) =>
                  position === index ? next : entry,
                ),
              }),
          }),
          h(
            "button",
            {
              type: "button",
              disabled: node.children.length === 1,
              onClick: () =>
                update({
                  ...node,
                  children: node.children.filter((_, position) => position !== index),
                }),
            },
            `Remove condition ${index + 1}`,
          ),
        ),
      ),
      ...Object.entries(registration.fields)
        .filter(([, field]) => field.operators.length > 0)
        .map(([name, field]) =>
          h(
            "button",
            {
              key: name,
              type: "button",
              onClick: () => {
                const operator = field.operators[0];
                if (!operator) return;
                update({
                  ...node,
                  children: [
                    ...node.children,
                    {
                      kind: "fact",
                      field: name,
                      operator,
                      value:
                        field.values?.[0] ??
                        (field.type === "boolean" ? false : field.type === "number" ? 0 : ""),
                    },
                  ],
                });
              },
            },
            `Add fact: ${name}`,
          ),
        ),
      ...registration.events.map((event) =>
        h(
          "button",
          {
            key: event,
            type: "button",
            onClick: () =>
              update({
                ...node,
                children: [
                  ...node.children,
                  {
                    kind: "event",
                    event,
                    metric: "count",
                    operator: "eq",
                    value: 0,
                    windowDays: 7,
                  },
                ],
              }),
          },
          `Add event: ${event}`,
        ),
      ),
      ...registration.memberships.map((membershipId) =>
        h(
          "button",
          {
            key: membershipId,
            type: "button",
            onClick: () =>
              update({ ...node, children: [...node.children, { kind: "static", membershipId }] }),
          },
          `Add membership: ${membershipId}`,
        ),
      ),
    );
  if (node.kind === "not")
    return h(
      "fieldset",
      null,
      h("legend", null, "NOT (unknown remains unknown)"),
      h(PredicateEditor, {
        node: node.child,
        registration,
        update: (child) => update({ ...node, child }),
      }),
    );
  if (node.kind === "static")
    return h(
      "fieldset",
      null,
      h("legend", null, "Static membership"),
      select("Membership", node.membershipId, registration.memberships, (membershipId) =>
        update({ ...node, membershipId }),
      ),
    );
  if (node.kind === "event")
    return h(
      "fieldset",
      null,
      h("legend", null, "Observed behavior"),
      select("Event", node.event, registration.events, (event) => update({ ...node, event })),
      select("Metric", node.metric, ["count", "distinct-calendar-days"], (metric) =>
        update({ ...node, metric: metric as "count" | "distinct-calendar-days" }),
      ),
      select("Event operator", node.operator, ["eq", "ne", "gt", "gte", "lt", "lte"], (operator) =>
        update({ ...node, operator: operator as typeof node.operator }),
      ),
      input(
        "Event threshold",
        node.value,
        (value) => update({ ...node, value: Number(value) }),
        "number",
      ),
      input(
        "Window days",
        node.windowDays,
        (value) => update({ ...node, windowDays: Number(value) }),
        "number",
      ),
    );
  const field = registration.fields[node.field];
  if (!field)
    return h("p", { role: "alert" }, "Field is unavailable. Reload the authorized registration.");
  const valueInput =
    field.values || field.type === "boolean"
      ? select(
          "Fact value",
          String(node.value),
          (field.values ?? [true, false]).map(String),
          (value) =>
            update({
              ...node,
              value:
                field.type === "number"
                  ? Number(value)
                  : field.type === "boolean"
                    ? value === "true"
                    : value,
            }),
        )
      : input(
          "Fact value",
          String(node.value),
          (value) => update({ ...node, value: field.type === "number" ? Number(value) : value }),
          field.type === "number" ? "number" : "text",
        );
  return h(
    "fieldset",
    null,
    h("legend", null, "Registered fact"),
    select("Field", node.field, Object.keys(registration.fields), (name) => {
      const next = registration.fields[name];
      if (!next || !next.operators[0]) return;
      const value: CohortScalar =
        next.values?.[0] ?? (next.type === "boolean" ? false : next.type === "number" ? 0 : "");
      update({ ...node, field: name, operator: next.operators[0], value });
    }),
    select("Fact operator", node.operator, field.operators, (operator) =>
      update({ ...node, operator: operator as typeof node.operator }),
    ),
    valueInput,
  );
}
export function CohortBuilder(props: CohortBuilderProps): ReactElement {
  const [definition, setDefinition] = useState(props.definition);
  const [sampleLimit, setSampleLimit] = useState(10);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string>();
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);
  const ready = props.state.kind === "ready" ? props.state : undefined;
  const preview = ready?.preview;
  const execute = async (action: () => Promise<void>) => {
    setPending(true);
    setError(undefined);
    try {
      await action();
    } catch (failure) {
      const code =
        failure instanceof Error && "code" in failure && typeof failure.code === "string"
          ? failure.code
          : "COHORT_OPERATION_FAILED";
      setError(`${code}. Review the request and preview again before publishing.`);
    } finally {
      setPending(false);
    }
  };
  return h(
    "section",
    {
      "aria-label": "Cohort Builder",
      "aria-busy": pending || props.state.kind === "loading",
      style: { maxWidth: "64rem", padding: "1rem", overflowWrap: "anywhere" },
    },
    h("h2", null, "Cohort Builder"),
    h(
      "p",
      null,
      `${definition.scope.appId} / ${definition.scope.environment} / ${definition.scope.tenantId} · ${definition.subjectKind}`,
    ),
    props.state.kind === "loading"
      ? h("p", { role: "status" }, "Loading registered fields…")
      : null,
    props.state.kind === "denied" || props.state.kind === "failed"
      ? h("p", { role: "alert" }, props.state.code)
      : null,
    error ? h("p", { role: "alert", tabIndex: -1, ref: errorRef }, error) : null,
    h(
      "fieldset",
      { disabled: pending || !ready || !props.canPreview },
      h("legend", null, `Definition ${definition.id} · version ${definition.version}`),
      h(PredicateEditor, {
        node: definition.root,
        registration: props.registration,
        update: (root) => {
          setDefinition({
            ...definition,
            version: dirty ? definition.version : definition.version + 1,
            root,
          });
          setDirty(true);
        },
      }),
      input("Sample limit (1–50)", sampleLimit, (value) => setSampleLimit(Number(value)), "number"),
      h(
        "button",
        {
          type: "button",
          disabled: !Number.isInteger(sampleLimit) || sampleLimit < 1 || sampleLimit > 50,
          onClick: () =>
            void execute(async () => {
              await props.onPreview({ definition, asOf: props.asOf, sampleLimit });
              setDirty(false);
            }),
        },
        pending ? "Working…" : "Preview cohort",
      ),
    ),
    preview
      ? h(
          "section",
          { "aria-label": "Preview results" },
          h("h3", null, "Preview results"),
          h(
            "p",
            { role: "status" },
            `Run ${preview.run.id}: ${preview.run.status}${dirty ? " · draft changed; preview again" : ""}`,
          ),
          h(
            "p",
            null,
            `${preview.matched} match / ${preview.unknown} unknown / ${preview.total} evaluated`,
          ),
          preview.previousMatched !== undefined
            ? h(
                "p",
                null,
                `Revision membership change: ${preview.matched - preview.previousMatched}`,
              )
            : null,
          h(
            "ul",
            null,
            preview.sample
              .slice(0, Math.min(50, sampleLimit))
              .map((member) =>
                h(
                  "li",
                  { key: member.subjectId },
                  h("strong", null, `${member.subjectId}: ${member.result}`),
                  h(
                    "pre",
                    { style: { whiteSpace: "pre-wrap" } },
                    JSON.stringify(member.explanation, null, 2),
                  ),
                ),
              ),
          ),
          h(
            "fieldset",
            {
              disabled: pending || dirty || !props.canPublish || preview.run.status !== "complete",
            },
            h("legend", null, "Publish completed membership"),
            input("Publication reason", reason, setReason),
            h(
              "button",
              {
                type: "button",
                disabled: !reason.trim(),
                onClick: () =>
                  void execute(() =>
                    props.onPublish({
                      definition,
                      runId: preview.run.id,
                      actor: props.actor,
                      reason,
                      expectedRevision: ready?.history[0]?.snapshot.publicationRevision ?? 0,
                      idempotencyKey: `${preview.run.id}:${ready?.history[0]?.snapshot.publicationRevision ?? 0}`,
                    }),
                  ),
              },
              "Publish cohort",
            ),
          ),
        )
      : null,
    ready
      ? h(
          "section",
          { "aria-label": "Publication history" },
          h("h3", null, "Publication history"),
          ready.history.length === 0
            ? h("p", null, "No published revisions")
            : h(
                "ol",
                null,
                ready.history.map((item) =>
                  h(
                    "li",
                    { key: item.snapshot.snapshotId },
                    `Revision ${item.snapshot.publicationRevision}: ${item.memberCount} members · ${item.actor} · ${item.reason} · valid until ${item.snapshot.validUntil}`,
                  ),
                ),
              ),
        )
      : null,
  );
}
