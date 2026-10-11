import { createElement as h, useState } from "react";
import type { ChangeEvent, ReactElement } from "react";
import type { JourneyDefinition, JourneyNode } from "@croco/lifecycle-core";
import type {
  JourneyAdminCommand,
  JourneyAdminPermission,
  JourneyAdminState,
  JourneyDryRunView,
  JourneyEpisodeView,
} from "@croco/admin-core";

export type JourneyConsoleProps = {
  /** Change this key when the authenticated scope changes. */
  scopeKey: string;
  definition: JourneyDefinition;
  state: JourneyAdminState;
  permissions: readonly JourneyAdminPermission[];
  samples: readonly { id: string; label: string }[];
  onDryRun(definition: JourneyDefinition, sampleId: string): Promise<JourneyDryRunView>;
  onCommand(command: JourneyAdminCommand): Promise<JourneyEpisodeView>;
};

function field(
  label: string,
  value: string | number,
  onChange: (value: string) => void,
): ReactElement {
  return h(
    "label",
    { style: { display: "grid", gap: 4, marginBlock: 8 } },
    label,
    h("input", {
      "aria-label": label,
      value,
      onChange: (event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value),
    }),
  );
}

function Editor(props: JourneyConsoleProps): ReactElement {
  const [definition, setDefinition] = useState(props.definition);
  const [sample, setSample] = useState(props.samples[0]?.id ?? "");
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<JourneyDryRunView>();
  const [updated, setUpdated] = useState<Readonly<Record<string, JourneyEpisodeView>>>({});
  const [feedback, setFeedback] = useState("");
  const episodes =
    props.state.kind === "ready"
      ? props.state.episodes.map((episode) => {
          const local = updated[episode.id];
          return local && local.revision > episode.revision ? local : episode;
        })
      : [];
  const update = (node: JourneyNode) => {
    setDefinition({
      ...definition,
      nodes: definition.nodes.map((item) => (item.id === node.id ? node : item)),
    });
    setPreview(undefined);
  };
  const run = async (operation: () => Promise<void>) => {
    setPending(true);
    setError(null);
    setFeedback("");
    try {
      await operation();
    } catch (failure) {
      const code =
        typeof failure === "object" && failure !== null && "code" in failure
          ? failure.code
          : undefined;
      setError(
        typeof code === "string" && /^(?:journey|lifecycle-core)\/[a-z0-9-]{1,80}$/.test(code)
          ? code
          : "journey/operation-failed",
      );
    } finally {
      setPending(false);
    }
  };
  return h(
    "section",
    { "aria-label": "Journey console", "aria-busy": pending },
    h("h1", null, "Journey console"),
    h("p", null, `${definition.id} · ${definition.version}`),
    props.state.kind === "empty" ? h("p", null, "No active episodes.") : null,
    h(
      "fieldset",
      { disabled: pending || !props.permissions.includes("journey.preview") },
      h("legend", null, "Ordered journey steps"),
      h(
        "ol",
        null,
        definition.nodes.map((node) =>
          h(
            "li",
            { key: node.id },
            h("h3", null, `${node.id} · ${node.kind}`),
            node.kind === "wait"
              ? field("Wait milliseconds", node.durationMs, (value) =>
                  update({ ...node, durationMs: Number(value) }),
                )
              : null,
            node.kind === "condition"
              ? h(
                  "div",
                  null,
                  field("Condition registration", node.predicate.registration, (value) =>
                    update({ ...node, predicate: { ...node.predicate, registration: value } }),
                  ),
                  field("Matched branch", node.matched, (value) =>
                    update({ ...node, matched: value }),
                  ),
                  field("Unmatched branch", node.unmatched, (value) =>
                    update({ ...node, unmatched: value }),
                  ),
                )
              : null,
            node.kind === "action"
              ? field("Action registration", node.action.registration, (value) =>
                  update({ ...node, action: { ...node.action, registration: value } }),
                )
              : null,
            node.kind === "wait" || node.kind === "action"
              ? field("Next step", node.next, (value) => update({ ...node, next: value }))
              : null,
          ),
        ),
      ),
      h(
        "label",
        null,
        "Sample subject",
        h(
          "select",
          {
            "aria-label": "Sample subject",
            value: sample,
            onChange: (event: ChangeEvent<HTMLSelectElement>) => {
              setSample(event.target.value);
              setPreview(undefined);
            },
          },
          props.samples.map((item) => h("option", { key: item.id, value: item.id }, item.label)),
        ),
      ),
      h(
        "button",
        {
          type: "button",
          disabled: !sample,
          onClick: () => {
            setPreview(undefined);
            void run(async () => {
              setPreview(await props.onDryRun(definition, sample));
            });
          },
        },
        "Dry run",
      ),
    ),
    pending ? h("p", { role: "status" }, "Running operation…") : null,
    error
      ? h(
          "p",
          { role: "alert" },
          `${error}: Journey operation failed. Refresh episode state and review server evidence before retrying. Reconcile uncertain actions before resuming.`,
        )
      : null,
    feedback ? h("p", { role: "status" }, feedback) : null,
    preview
      ? h(
          "section",
          { "aria-label": "Dry-run result" },
          h("h2", null, "Dry run — no actions dispatched"),
          h(
            "ol",
            null,
            preview.steps.map((step, index) =>
              h("li", { key: `${step.nodeId}:${index}` }, `${step.nodeId}: ${step.outcome}`),
            ),
          ),
        )
      : null,
    h("h2", null, "Episodes"),
    field("Audit reason", reason, setReason),
    episodes.length === 0 && props.state.kind !== "empty"
      ? h("p", null, "No active episodes.")
      : null,
    episodes.map((episode) =>
      h(
        "article",
        { key: episode.id, "aria-label": `Episode ${episode.id}` },
        h("h3", null, episode.id),
        h("p", null, `${episode.status} · step ${episode.nodeId} · revision ${episode.revision}`),
        h("p", null, `Reason: ${episode.reason}`),
        episode.problemCode ? h("p", { role: "alert" }, episode.problemCode) : null,
        h("p", null, `Safe resume: ${episode.safeResume ? "yes" : "no"}`),
        h(
          "ul",
          null,
          episode.receipts.map((receipt, index) =>
            h(
              "li",
              { key: index },
              `${receipt.nodeId} · ${receipt.evaluatedAt} · ${receipt.reason}`,
              receipt.checks
                ? h(
                    "p",
                    null,
                    `Checks at ${receipt.checks.evaluatedAt}: goal ${receipt.checks.goal}, consent ${receipt.checks.consent}, resource ${receipt.checks.resource}`,
                  )
                : null,
              receipt.problemCode ? h("p", null, receipt.problemCode) : null,
            ),
          ),
        ),
        episode.wakeAt ? h("p", null, `Next wake: ${episode.wakeAt}`) : null,
        (episode.status === "paused" && episode.safeResume
          ? (["resume", "stop"] as const)
          : episode.status === "running" || episode.status === "waiting"
            ? (["pause", "stop"] as const)
            : episode.status === "indeterminate"
              ? (["stop"] as const)
              : []
        ).map((type) =>
          h(
            "button",
            {
              key: type,
              type: "button",
              disabled: pending || !reason.trim() || !props.permissions.includes("journey.operate"),
              onClick: () => {
                void run(async () => {
                  const next = await props.onCommand({
                    episodeId: episode.id,
                    type,
                    expectedRevision: episode.revision,
                    reason,
                    idempotencyKey: crypto.randomUUID(),
                  });
                  setUpdated((previous) => ({ ...previous, [next.id]: next }));
                  setFeedback(`Episode ${next.id}: ${next.status}`);
                });
              },
            },
            type === "pause" ? "Pause" : type === "resume" ? "Resume" : "Stop",
          ),
        ),
      ),
    ),
  );
}

export function JourneyConsole(props: JourneyConsoleProps): ReactElement {
  if (props.state.kind === "loading") return h("p", { role: "status" }, "Loading journeys…");
  if (props.state.kind === "denied" || !props.permissions.includes("journey.read"))
    return h("p", { role: "alert" }, "Journey access denied.");
  if (props.state.kind === "error")
    return h("p", { role: "alert" }, `Journey unavailable: ${props.state.code}`);
  return h(Editor, {
    ...props,
    key: JSON.stringify([props.scopeKey, props.definition.id, props.definition.version]),
  });
}
