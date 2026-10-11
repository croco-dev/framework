import { createElement as h, useRef, useState } from "react";
import type { ChangeEvent, ReactElement } from "react";
import type { SavedIntentAdminState, SavedIntentInspection } from "@croco/admin-core";
import type { SavedIntentPolicy } from "@croco/experience-core";

export type SavedIntentConsoleProps = Readonly<{
  state: SavedIntentAdminState;
  canWrite: boolean;
  targets: readonly Readonly<{ id: string; label: string }>[];
  onSave(
    input: Readonly<{
      policy: SavedIntentPolicy;
      expectedRevision: number | null;
      reason: string;
      idempotencyKey: string;
    }>,
  ): Promise<SavedIntentPolicy>;
  onInspect(targetId: string, offset: number): Promise<SavedIntentInspection>;
  onReload(): void;
}>;

function failureMessage(error: unknown): string {
  return error instanceof Error && "code" in error && typeof error.code === "string"
    ? error.code
    : "Saved intent operation failed. Reload and try again.";
}

export function SavedIntentConsole(props: SavedIntentConsoleProps): ReactElement {
  if (props.state.kind !== "ready") {
    return h(
      "section",
      { "aria-label": "Saved intent console", "aria-busy": props.state.kind === "loading" },
      h("h2", null, "Saved intent console"),
      h(
        "p",
        { role: props.state.kind === "loading" ? "status" : "alert" },
        props.state.kind === "loading" ? "Loading saved intent policies…" : props.state.message,
      ),
      props.state.kind === "error"
        ? h("button", { type: "button", onClick: props.onReload }, "Reload")
        : null,
    );
  }
  return h(
    "section",
    {
      "aria-label": "Saved intent console",
      style: { maxWidth: "48rem", overflowWrap: "anywhere" },
    },
    h("h2", null, "Saved intent console"),
    props.state.policies.length === 0 ? h("p", null, "No declared resource types") : null,
    ...props.state.policies.map((policy) =>
      h(PolicyEditor, {
        key: JSON.stringify([policy.scope, policy.resourceType, policy.revision]),
        policy,
        props,
      }),
    ),
    h(Inspection, {
      key: JSON.stringify([props.state.policies.map((policy) => policy.scope), props.targets]),
      props,
    }),
  );
}

function PolicyEditor({
  policy,
  props,
}: {
  policy: SavedIntentPolicy;
  props: SavedIntentConsoleProps;
}): ReactElement {
  const [baseline, setBaseline] = useState(policy);
  const [draft, setDraft] = useState(policy);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<string>();
  const [error, setError] = useState<string>();
  const attempt = useRef<{ fingerprint: string; key: string } | undefined>(undefined);
  const busy = useRef(false);
  const save = async (): Promise<void> => {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError(undefined);
    setFeedback(undefined);
    const request = {
      policy: draft,
      expectedRevision: baseline.revision === 0 ? null : baseline.revision,
      reason,
    };
    const fingerprint = JSON.stringify(request);
    const command =
      attempt.current?.fingerprint === fingerprint
        ? attempt.current
        : { fingerprint, key: crypto.randomUUID() };
    attempt.current = command;
    try {
      const saved = await props.onSave({ ...request, idempotencyKey: command.key });
      setBaseline(saved);
      setDraft(saved);
      setReason("");
      attempt.current = undefined;
      setFeedback(`Policy saved · revision ${saved.revision}`);
    } catch (failure) {
      setError(failureMessage(failure));
    } finally {
      busy.current = false;
      setPending(false);
    }
  };
  const numberField = (
    label: string,
    name: "displayLimit" | "retentionDays",
    min: number,
  ): ReactElement =>
    h(
      "label",
      { style: { display: "block", marginBlock: "0.5rem" } },
      label,
      h("input", {
        "aria-label": `${draft.resourceType} ${label}`,
        type: "number",
        min,
        max: name === "displayLimit" ? 100 : 3650,
        required: true,
        value: draft[name],
        onChange: (event: ChangeEvent<HTMLInputElement>) => {
          setDraft({ ...draft, [name]: Number(event.target.value) });
          setFeedback(undefined);
        },
      }),
    );
  return h(
    "form",
    {
      onSubmit: (event) => {
        event.preventDefault();
        void save();
      },
      "aria-busy": pending,
    },
    h(
      "fieldset",
      { disabled: pending || !props.canWrite },
      h("legend", null, `${draft.resourceType} · revision ${baseline.revision}`),
      h("p", null, `${draft.scope.appId} / ${draft.scope.environment} / ${draft.scope.tenantId}`),
      numberField("Display limit", "displayLimit", 1),
      numberField("Retention days", "retentionDays", 1),
      h(
        "label",
        null,
        h("input", {
          type: "checkbox",
          checked: draft.excludeCompleted,
          onChange: (event: ChangeEvent<HTMLInputElement>) => {
            setDraft({ ...draft, excludeCompleted: event.target.checked });
            setFeedback(undefined);
          },
        }),
        "Exclude completed",
      ),
      h(
        "label",
        { style: { display: "block", marginBlock: "0.5rem" } },
        "Change reason",
        h("input", {
          required: true,
          value: reason,
          "aria-label": `${draft.resourceType} Change reason`,
          onChange: (event: ChangeEvent<HTMLInputElement>) => setReason(event.target.value),
        }),
      ),
      h("button", { type: "submit", disabled: !reason.trim() }, "Save policy"),
    ),
    feedback ? h("p", { role: "status" }, feedback) : null,
    error
      ? h(
          "div",
          { role: "alert" },
          h("p", null, error),
          h(
            "button",
            { type: "button", onClick: props.onReload, disabled: pending },
            "Reload current policy",
          ),
        )
      : null,
  );
}

function Inspection({ props }: { props: SavedIntentConsoleProps }): ReactElement {
  const [selected, setSelected] = useState(props.targets[0]?.id ?? "");
  const [result, setResult] = useState<SavedIntentInspection>();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const inspect = async (offset: number): Promise<void> => {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError(undefined);
    setResult(undefined);
    try {
      setResult(await props.onInspect(selected, offset));
    } catch (failure) {
      setError(failureMessage(failure));
    } finally {
      busy.current = false;
      setPending(false);
    }
  };
  return h(
    "section",
    { "aria-label": "Saved intent inspection", "aria-busy": pending },
    h("h3", null, "Candidate availability and exclusions"),
    props.targets.length === 0
      ? h("p", null, "No authorized inspection targets")
      : h(
          "label",
          null,
          "Subject",
          h(
            "select",
            {
              value: selected,
              disabled: pending,
              onChange: (event: ChangeEvent<HTMLSelectElement>) => {
                setSelected(event.target.value);
                setResult(undefined);
                setError(undefined);
              },
            },
            props.targets.map((target) =>
              h("option", { key: target.id, value: target.id }, target.label),
            ),
          ),
        ),
    h(
      "button",
      { type: "button", disabled: pending || !selected, onClick: () => void inspect(0) },
      "Inspect",
    ),
    pending ? h("p", { role: "status" }, "Checking current availability…") : null,
    error ? h("p", { role: "alert" }, error) : null,
    result
      ? h(
          "div",
          null,
          result.rows.length === 0
            ? h("p", null, "No resume candidates")
            : h(
                "ul",
                null,
                result.rows.map((row) =>
                  h(
                    "li",
                    { key: row.intentId },
                    `${row.resourceType} · ${row.intentId} · ${row.availability} · ${row.rankReason}`,
                  ),
                ),
              ),
          h("h4", null, "Excluded items"),
          result.exclusions.length === 0
            ? h("p", null, "No exclusions")
            : h(
                "ul",
                null,
                result.exclusions.map((row) =>
                  h(
                    "li",
                    { key: row.intentId },
                    `${row.resourceType} · ${row.intentId} · ${row.reason}`,
                  ),
                ),
              ),
          result.nextOffset === undefined
            ? null
            : h(
                "button",
                {
                  type: "button",
                  disabled: pending,
                  onClick: () => {
                    if (result.nextOffset !== undefined) void inspect(result.nextOffset);
                  },
                },
                "Next page",
              ),
        )
      : null,
  );
}
