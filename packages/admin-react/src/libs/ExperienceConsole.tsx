import { createElement as h, useEffect, useRef, useState } from "react";
import { ExperienceSlot } from "@croco/frontend-react/experience-slot";
import type { ChangeEvent, ReactElement } from "react";
import type { ExperienceAdminPreview, ExperienceAdminState } from "@croco/admin-core";
import type {
  ExperienceConfig,
  ExperienceContextPredicate,
  ExperienceDecision,
  PlacementDefinition,
} from "@croco/experience-core";
import type { ExperienceRenderer } from "@croco/frontend-react/experience-slot";

export type ExperienceConsoleProps = Readonly<{
  placement: PlacementDefinition;
  config: ExperienceConfig;
  state: ExperienceAdminState;
  renderers: Readonly<Record<string, ExperienceRenderer>>;
  canPreview: boolean;
  canPublish: boolean;
  onPreview(config: ExperienceConfig): Promise<ExperienceAdminPreview>;
  onSave(
    input: Readonly<{
      config: ExperienceConfig;
      expectedRevision: number | null;
      reason: string;
      idempotencyKey: string;
    }>,
  ): Promise<ExperienceConfig>;
}>;

function field(
  label: string,
  value: string | number,
  update: (value: string) => void,
  type = "text",
): ReactElement {
  return h(
    "label",
    { style: { display: "block", marginBlock: "0.5rem" } },
    label,
    h("input", {
      type,
      value,
      onChange: (event: ChangeEvent<HTMLInputElement>) => update(event.target.value),
    }),
  );
}

function PredicateValueField(props: {
  label: string;
  value: string;
  commit(value: string): void;
}): ReactElement {
  const [draft, setDraft] = useState(props.value);
  useEffect(() => setDraft(props.value), [props.value]);
  return h(
    "label",
    { style: { display: "block", marginBlock: "0.5rem" } },
    props.label,
    h("input", {
      value: draft,
      onChange: (event: ChangeEvent<HTMLInputElement>) => setDraft(event.target.value),
      onBlur: () => {
        if (draft !== props.value) props.commit(draft);
      },
    }),
  );
}

function previewDecision(
  config: ExperienceConfig,
  preview: ExperienceAdminPreview,
): ExperienceDecision {
  return {
    decisionId: "preview",
    placementId: config.placementId,
    configId: config.id,
    policyVersion: config.revision,
    scope: config.scope,
    subject: { kind: "preview", id: "preview" },
    renderer: preview.renderer,
    content: preview.content,
    selectedAt: "1970-01-01T00:00:00.000Z",
    expiresAt: "1970-01-01T00:01:00.000Z",
    reason: "matched",
  };
}

export function ExperienceConsole(props: ExperienceConsoleProps): ReactElement {
  const { appId, environment, tenantId } = props.config.scope;
  return h(ExperienceConsoleEditor, {
    ...props,
    key: JSON.stringify([appId, environment, tenantId, props.config.id, props.placement.id]),
  });
}

function ExperienceConsoleEditor(props: ExperienceConsoleProps): ReactElement {
  const [config, setConfig] = useState(props.config);
  const [baseline, setBaseline] = useState(props.config);
  const [preview, setPreview] = useState<ExperienceAdminPreview>();
  const [previewSequence, setPreviewSequence] = useState(0);
  const [reason, setReason] = useState("");
  const [selectedPredicateIndex, setSelectedPredicateIndex] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const errorRef = useRef<HTMLParagraphElement>(null);
  const saveAttempt = useRef<{ fingerprint: string; key: string } | undefined>(undefined);
  const changed = JSON.stringify(config) !== JSON.stringify(baseline);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  const update = (change: Partial<ExperienceConfig>): void => {
    setConfig({ ...config, ...change, revision: changed ? config.revision : config.revision + 1 });
    setPreview(undefined);
  };
  const run = async (action: () => Promise<void>): Promise<void> => {
    setPending(true);
    setError(undefined);
    try {
      await action();
    } catch (failure) {
      setError(
        failure instanceof Error && "code" in failure && typeof failure.code === "string"
          ? failure.code
          : "Experience operation failed. Review the fields and try again.",
      );
    } finally {
      setPending(false);
    }
  };
  const save = (status: ExperienceConfig["status"]): void => {
    setPreview(undefined);
    void run(async () => {
      const next = { ...config, status, revision: changed ? config.revision : config.revision + 1 };
      const request = {
        config: next,
        expectedRevision: baseline.revision,
        reason,
      };
      const fingerprint = JSON.stringify(request);
      const attempt =
        saveAttempt.current?.fingerprint === fingerprint
          ? saveAttempt.current
          : { fingerprint, key: globalThis.crypto.randomUUID() };
      saveAttempt.current = attempt;
      const saved = await props.onSave({ ...request, idempotencyKey: attempt.key });
      saveAttempt.current = undefined;
      setConfig(saved);
      setBaseline(saved);
      setPreview(undefined);
      setReason("");
    });
  };
  const predicates = config.targeting?.context ?? [];
  const predicate = predicates[selectedPredicateIndex];
  const firstField = Object.keys(props.placement.schema.contextFields)[0];
  const setPredicate = (next: ExperienceContextPredicate | undefined): void => {
    const context = [...predicates];
    if (next) context[selectedPredicateIndex] = next;
    else context.splice(selectedPredicateIndex, 1);
    setSelectedPredicateIndex(Math.min(selectedPredicateIndex, Math.max(0, context.length - 1)));
    update({ targeting: { ...config.targeting, context } });
  };
  const selectedType = predicate
    ? props.placement.schema.contextFields[predicate.field]
    : undefined;

  if (props.state.kind !== "ready")
    return h(
      "section",
      { "aria-label": "Experience Console", "aria-busy": props.state.kind === "loading" },
      h("h2", null, "Experience Console"),
      h(
        "p",
        { role: props.state.kind === "loading" ? "status" : "alert" },
        props.state.kind === "loading" ? "Loading experiences…" : props.state.code,
      ),
    );

  return h(
    "section",
    {
      "aria-label": "Experience Console",
      "aria-busy": pending,
      style: { maxWidth: "48rem", padding: "1rem", overflowWrap: "anywhere" },
    },
    h("h2", null, "Experience Console"),
    h(
      "p",
      null,
      `${config.scope.appId} / ${config.scope.environment} / ${config.scope.tenantId} · ${config.placementId}`,
    ),
    error ? h("p", { role: "alert", tabIndex: -1, ref: errorRef }, error) : null,
    h(
      "fieldset",
      { disabled: pending },
      h("legend", null, `${config.id} · revision ${config.revision} · ${config.status}`),
      h(
        "label",
        null,
        "Renderer",
        h(
          "select",
          {
            value: config.renderer,
            onChange: (event: ChangeEvent<HTMLSelectElement>) =>
              update({ renderer: event.target.value }),
          },
          props.placement.allowedRenderers.map((renderer) =>
            h("option", { key: renderer, value: renderer }, renderer),
          ),
        ),
      ),
      h(
        "label",
        null,
        "Locale",
        h(
          "select",
          {
            value: config.content.locale,
            onChange: (event: ChangeEvent<HTMLSelectElement>) =>
              update({ content: { ...config.content, locale: event.target.value } }),
          },
          props.placement.schema.content.locales.map((locale) =>
            h("option", { key: locale, value: locale }, locale),
          ),
        ),
      ),
      field("Title", config.content.title, (title) =>
        update({ content: { ...config.content, title } }),
      ),
      h(
        "label",
        { style: { display: "block" } },
        "Body",
        h("textarea", {
          value: config.content.body,
          onChange: (event: ChangeEvent<HTMLTextAreaElement>) =>
            update({ content: { ...config.content, body: event.target.value } }),
        }),
      ),
      field("Action URL", config.content.actionUrl ?? "", (actionUrl) =>
        update({
          content: { ...config.content, actionUrl: actionUrl || undefined },
        }),
      ),
      field(
        "Priority",
        config.priority,
        (priority) => update({ priority: Number(priority) }),
        "number",
      ),
      field("Start at (ISO)", config.startAt ?? "", (startAt) =>
        update({ startAt: startAt || undefined }),
      ),
      field("End at (ISO)", config.endAt ?? "", (endAt) => update({ endAt: endAt || undefined })),
      field(
        "Maximum displays",
        config.frequency?.maxDisplays ?? "",
        (value) =>
          update({
            frequency: value
              ? {
                  maxDisplays: Number(value),
                  windowSeconds: config.frequency?.windowSeconds ?? 86400,
                }
              : undefined,
          }),
        "number",
      ),
      field(
        "Frequency window (seconds)",
        config.frequency?.windowSeconds ?? "",
        (value) =>
          update({
            frequency: value
              ? { maxDisplays: config.frequency?.maxDisplays ?? 1, windowSeconds: Number(value) }
              : undefined,
          }),
        "number",
      ),
      firstField
        ? h(
            "fieldset",
            null,
            h("legend", null, "Registered context condition"),
            predicates.length > 1
              ? h(
                  "label",
                  null,
                  "Condition",
                  h(
                    "select",
                    {
                      value: selectedPredicateIndex,
                      onChange: (event: ChangeEvent<HTMLSelectElement>) =>
                        setSelectedPredicateIndex(Number(event.target.value)),
                    },
                    predicates.map((_, index) =>
                      h("option", { key: index, value: index }, `Condition ${index + 1}`),
                    ),
                  ),
                )
              : null,
            h(
              "label",
              null,
              "Field",
              h(
                "select",
                {
                  value: predicate?.field ?? "",
                  onChange: (event: ChangeEvent<HTMLSelectElement>) => {
                    const name = event.target.value;
                    const type = props.placement.schema.contextFields[name];
                    setPredicate(
                      name && type
                        ? {
                            field: name,
                            operator: "eq",
                            value: type === "boolean" ? false : type === "number" ? 0 : "",
                          }
                        : undefined,
                    );
                  },
                },
                h("option", { value: "" }, "None"),
                Object.keys(props.placement.schema.contextFields).map((name) =>
                  h("option", { key: name, value: name }, name),
                ),
              ),
            ),
            predicate
              ? h(
                  "label",
                  null,
                  "Operator",
                  h(
                    "select",
                    {
                      value: predicate.operator,
                      onChange: (event: ChangeEvent<HTMLSelectElement>) =>
                        setPredicate(
                          event.target.value === "in"
                            ? {
                                field: predicate.field,
                                operator: "in",
                                value: [
                                  predicate.operator === "eq"
                                    ? predicate.value
                                    : (predicate.value[0] ?? ""),
                                ],
                              }
                            : {
                                field: predicate.field,
                                operator: "eq",
                                value:
                                  predicate.operator === "in"
                                    ? (predicate.value[0] ?? "")
                                    : predicate.value,
                              },
                        ),
                    },
                    h("option", { value: "eq" }, "Equals"),
                    h("option", { value: "in" }, "In list"),
                  ),
                )
              : null,
            predicate
              ? selectedType === "boolean"
                ? predicate.operator === "eq"
                  ? h(
                      "label",
                      null,
                      "Value",
                      h(
                        "select",
                        {
                          value: String(predicate.value),
                          onChange: (event: ChangeEvent<HTMLSelectElement>) =>
                            setPredicate({ ...predicate, value: event.target.value === "true" }),
                        },
                        h("option", { value: "false" }, "False"),
                        h("option", { value: "true" }, "True"),
                      ),
                    )
                  : h(
                      "fieldset",
                      null,
                      h("legend", null, "Values"),
                      ([false, true] as const).map((value) =>
                        h(
                          "label",
                          { key: String(value) },
                          h("input", {
                            type: "checkbox",
                            checked: predicate.value.includes(value),
                            onChange: (event: ChangeEvent<HTMLInputElement>) =>
                              setPredicate({
                                ...predicate,
                                value: event.target.checked
                                  ? [...predicate.value, value]
                                  : predicate.value.filter((part) => part !== value),
                              }),
                          }),
                          String(value),
                        ),
                      ),
                    )
                : h(PredicateValueField, {
                    key: `${selectedPredicateIndex}:${predicate.field}:${predicate.operator}`,
                    label: predicate.operator === "in" ? "Values (comma separated)" : "Value",
                    value:
                      predicate.operator === "in"
                        ? predicate.value.join(",")
                        : String(predicate.value),
                    commit: (value: string) => {
                      const parse = (part: string): string | number =>
                        selectedType === "number" ? Number(part) : part.trim();
                      setPredicate(
                        predicate.operator === "in"
                          ? { ...predicate, value: value.split(",").map(parse) }
                          : { ...predicate, value: parse(value) },
                      );
                    },
                  })
              : null,
            h(
              "button",
              {
                type: "button",
                onClick: () => {
                  const field = firstField;
                  if (!field) return;
                  const type = props.placement.schema.contextFields[field];
                  const context = [
                    ...predicates,
                    {
                      field,
                      operator: "eq" as const,
                      value: type === "boolean" ? false : type === "number" ? 0 : "",
                    },
                  ];
                  setSelectedPredicateIndex(context.length - 1);
                  update({ targeting: { ...config.targeting, context } });
                },
              },
              "Add condition",
            ),
            predicate
              ? h(
                  "button",
                  { type: "button", onClick: () => setPredicate(undefined) },
                  "Remove condition",
                )
              : null,
          )
        : null,
      field(
        "Static subject IDs (comma separated)",
        config.targeting?.staticSubjectIds?.join(",") ?? "",
        (value) =>
          update({
            targeting: {
              ...config.targeting,
              staticSubjectIds: value ? value.split(",").map((id) => id.trim()) : undefined,
            },
          }),
      ),
      field(
        "Published cohort snapshot ID",
        config.targeting?.cohortSnapshotId ?? "",
        (cohortSnapshotId) =>
          update({
            targeting: { ...config.targeting, cohortSnapshotId: cohortSnapshotId || undefined },
          }),
      ),
      h(
        "button",
        {
          type: "button",
          disabled: !props.canPreview,
          onClick: () =>
            void run(async () => {
              setPreview(undefined);
              const next = await props.onPreview(config);
              setPreview(next);
              setPreviewSequence((sequence) => sequence + 1);
            }),
        },
        "Preview",
      ),
      field("Audit reason", reason, setReason),
      h(
        "button",
        { type: "button", disabled: !reason.trim(), onClick: () => save("draft") },
        "Save draft",
      ),
      h(
        "button",
        {
          type: "button",
          disabled: !reason.trim() || !props.canPublish || !preview,
          onClick: () => save("published"),
        },
        "Publish",
      ),
      h(
        "button",
        {
          type: "button",
          disabled: !reason.trim() || !props.canPublish || config.status !== "published",
          onClick: () => save("paused"),
        },
        "Pause",
      ),
      h(
        "button",
        {
          type: "button",
          disabled: !reason.trim() || !props.canPublish,
          onClick: () => save("archived"),
        },
        "Archive",
      ),
    ),
    preview
      ? h(
          "section",
          { "aria-label": "Experience preview" },
          h(
            "p",
            { role: "status" },
            preview.matched ? "Matches preview subject" : "Does not match preview subject",
          ),
          h(ExperienceSlot, {
            key: previewSequence,
            preview: true,
            decision: previewDecision(config, preview),
            renderers: props.renderers,
          }),
        )
      : null,
  );
}
