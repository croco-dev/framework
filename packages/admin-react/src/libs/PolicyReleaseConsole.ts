import { createElement as h, useState } from "react";
import type { ChangeEvent, ReactElement } from "react";

export type PolicyReleaseConsoleField = Readonly<{
  key: string;
  label: string;
  input: "text" | "number" | "boolean" | "datetime" | "select" | "json";
  value: unknown;
  options?: readonly Readonly<{ value: string; label: string }>[];
  min?: number;
  max?: number;
  sensitive?: boolean;
}>;

export type PolicyReleaseConsoleState =
  | Readonly<{ kind: "loading" }>
  | Readonly<{ kind: "denied"; code: string; message: string }>
  | Readonly<{ kind: "error"; code: string; message: string }>
  | Readonly<{ kind: "partial"; code: string; message: string }>
  | Readonly<{ kind: "empty" }>
  | Readonly<{
      kind: "ready";
      policyId: string;
      revision: number;
      status: string;
      fields: readonly PolicyReleaseConsoleField[];
      diagnostics: readonly Readonly<{
        code: string;
        path: string;
        severity: "error" | "warning";
      }>[];
      diff: readonly Readonly<{ field: string; before: string; after: string }>[];
      impact: readonly Readonly<{
        kind: "fact" | "estimate" | "insufficient-data";
        message: string;
      }>[];
      reviewHash?: string;
      reviewRequirements?: Readonly<{ risk: "low" | "financial"; independentReviewer: boolean }>;
      receipt?: Readonly<{ id: string; revision: number; status: string }>;
      canWrite: boolean;
      canReview: boolean;
      canPublish: boolean;
    }>;

export type PolicyReleaseConsoleProps = Readonly<{
  state: PolicyReleaseConsoleState;
  busy?: boolean;
  reason: string;
  effectiveAt: string;
  onReasonChange(value: string): void;
  onEffectiveAtChange(value: string): void;
  onEdit(field: string, value: unknown): void;
  onSave(): void;
  onReview(): void;
  onPublish(): void;
  onReload(): void;
}>;

/** Controlled view: callbacks call the authenticated PolicyReleaseOperations server boundary. */
export function PolicyReleaseConsole(props: PolicyReleaseConsoleProps): ReactElement {
  const { state, busy = false } = props;
  const [invalidJson, setInvalidJson] = useState<Readonly<Record<string, boolean>>>({});
  if (state.kind === "loading") {
    return h(
      "section",
      {
        "aria-label": "Policy release console",
        "aria-busy": true,
        style: { overflowWrap: "anywhere", minWidth: 0 },
      },
      h("p", { role: "status" }, "Loading policy release"),
    );
  }
  if (state.kind === "denied" || state.kind === "error" || state.kind === "partial") {
    return h(
      "section",
      { "aria-label": "Policy release console", style: { overflowWrap: "anywhere", minWidth: 0 } },
      h(
        "h1",
        null,
        state.kind === "denied"
          ? "Policy access denied"
          : state.kind === "partial"
            ? "Policy data incomplete"
            : "Policy operation failed",
      ),
      h("p", { role: "alert" }, `${state.code}: ${state.message}`),
      h("button", { type: "button", onClick: props.onReload }, "Reload policy"),
    );
  }
  if (state.kind === "empty") {
    return h(
      "section",
      { "aria-label": "Policy release console", style: { overflowWrap: "anywhere", minWidth: 0 } },
      h("h1", null, "No policy revision"),
      h("p", null, "Create a draft through the registered policy service."),
      h("button", { type: "button", onClick: props.onReload }, "Reload policy"),
    );
  }
  const invalidFields = Object.entries(invalidJson).some(
    ([key, invalid]) => key.startsWith(`${state.revision}:`) && invalid,
  );
  const hasErrors = state.diagnostics.some(({ severity }) => severity === "error");
  const draft = state.status === "draft" || state.status === "reviewed";
  return h(
    "section",
    {
      "aria-label": "Policy release console",
      "aria-busy": busy,
      style: { overflowWrap: "anywhere", minWidth: 0 },
    },
    h("h1", null, `Policy ${state.policyId}`),
    h(
      "p",
      { role: "status" },
      busy ? "Policy operation in progress" : `Revision ${state.revision}: ${state.status}`,
    ),
    h(
      "label",
      null,
      "Change reason",
      h("input", {
        style: { maxWidth: "100%", boxSizing: "border-box" },
        value: props.reason,
        disabled: busy,
        onChange: (event: ChangeEvent<HTMLInputElement>) =>
          props.onReasonChange(event.currentTarget.value),
      }),
    ),
    h(
      "fieldset",
      { disabled: busy || !state.canWrite || !draft },
      h("legend", null, "Registered policy fields"),
      state.fields.map((field) =>
        h(
          "label",
          { key: field.key, style: { display: "block" } },
          field.input === "datetime" ? `${field.label} (UTC)` : field.label,
          field.input === "select"
            ? h(
                "select",
                {
                  style: { maxWidth: "100%", boxSizing: "border-box" },
                  name: field.key,
                  value: field.value === null ? "" : String(field.value),
                  onChange: (event: ChangeEvent<HTMLSelectElement>) =>
                    props.onEdit(field.key, event.currentTarget.value),
                },
                field.options?.map((option) =>
                  h("option", { key: option.value, value: option.value }, option.label),
                ),
              )
            : field.input === "json"
              ? h("textarea", {
                  style: { maxWidth: "100%", boxSizing: "border-box" },
                  key: `${state.revision}:${field.key}`,
                  name: field.key,
                  defaultValue: field.sensitive ? "" : JSON.stringify(field.value, null, 2),
                  "aria-invalid": invalidJson[`${state.revision}:${field.key}`] || undefined,
                  onChange: (event: ChangeEvent<HTMLTextAreaElement>) => {
                    let value: unknown;
                    try {
                      value = JSON.parse(event.currentTarget.value);
                    } catch {
                      setInvalidJson((current) => ({
                        ...current,
                        [`${state.revision}:${field.key}`]: true,
                      }));
                      return;
                    }
                    setInvalidJson((current) => ({
                      ...current,
                      [`${state.revision}:${field.key}`]: false,
                    }));
                    props.onEdit(field.key, value);
                  },
                })
              : h("input", {
                  style: { maxWidth: "100%", boxSizing: "border-box" },
                  name: field.key,
                  type:
                    field.input === "boolean"
                      ? "checkbox"
                      : field.sensitive
                        ? "password"
                        : field.input === "number"
                          ? "number"
                          : field.input === "datetime"
                            ? "datetime-local"
                            : "text",
                  ...(field.input === "boolean"
                    ? { checked: field.value === true }
                    : {
                        value:
                          field.value === null
                            ? ""
                            : field.input === "datetime"
                              ? String(field.value).replace(/Z$/, "")
                              : String(field.value),
                      }),
                  placeholder: field.sensitive ? "Value hidden; enter replacement" : undefined,
                  min: field.min,
                  max: field.max,
                  onChange: (event: ChangeEvent<HTMLInputElement>) => {
                    const input = event.currentTarget;
                    props.onEdit(
                      field.key,
                      field.input === "boolean"
                        ? input.checked
                        : field.input === "number"
                          ? input.valueAsNumber
                          : field.input === "datetime" && input.value
                            ? `${input.value}Z`
                            : input.value,
                    );
                  },
                }),
          invalidJson[`${state.revision}:${field.key}`]
            ? h("span", { role: "alert" }, "Enter valid JSON")
            : null,
        ),
      ),
      h(
        "button",
        { type: "button", disabled: invalidFields || !props.reason.trim(), onClick: props.onSave },
        "Save draft",
      ),
    ),
    h(
      "section",
      { "aria-label": "Validation" },
      h("h2", null, "Validation"),
      state.diagnostics.length === 0
        ? h("p", null, "No validation violations")
        : h(
            "ul",
            { role: hasErrors ? "alert" : "status" },
            state.diagnostics.map(({ code, path, severity }, index) =>
              h("li", { key: index, "data-severity": severity }, `${severity}: ${code}: ${path}`),
            ),
          ),
    ),
    h(
      "section",
      { "aria-label": "Policy diff" },
      h("h2", null, "Changes"),
      h(
        "ul",
        null,
        state.diff.map((change) =>
          h("li", { key: change.field }, `${change.field}: ${change.before} → ${change.after}`),
        ),
      ),
    ),
    h(
      "section",
      { "aria-label": "Policy impact" },
      h("h2", null, "Impact"),
      h(
        "ul",
        null,
        state.impact.map((item, index) =>
          h("li", { key: index, "data-impact-kind": item.kind }, `${item.kind}: ${item.message}`),
        ),
      ),
    ),
    state.reviewRequirements
      ? h(
          "p",
          null,
          `${state.reviewRequirements.risk} risk: ${state.reviewRequirements.independentReviewer || state.reviewRequirements.risk === "financial" ? "Independent reviewer required" : "Author may review"}`,
        )
      : null,
    h(
      "button",
      {
        type: "button",
        disabled:
          busy || !draft || !state.canReview || hasErrors || invalidFields || !props.reason.trim(),
        onClick: props.onReview,
      },
      "Review revision",
    ),
    h(
      "label",
      null,
      "Effective time (UTC, ISO 8601; blank publishes now)",
      h("input", {
        style: { maxWidth: "100%", boxSizing: "border-box" },
        value: props.effectiveAt,
        disabled: busy,
        placeholder: "2026-10-01T12:00:00.000Z",
        onChange: (event: ChangeEvent<HTMLInputElement>) =>
          props.onEffectiveAtChange(event.currentTarget.value),
      }),
    ),
    h(
      "button",
      {
        type: "button",
        disabled:
          busy ||
          !draft ||
          !state.canPublish ||
          !state.reviewHash ||
          hasErrors ||
          invalidFields ||
          !props.reason.trim(),
        onClick: props.onPublish,
      },
      props.effectiveAt ? "Schedule reviewed revision" : "Publish reviewed revision",
    ),
    state.receipt
      ? h(
          "section",
          { "aria-label": "Publication receipt" },
          h("h2", null, "Publication receipt"),
          h(
            "p",
            null,
            `${state.receipt.id}: revision ${state.receipt.revision}, ${state.receipt.status}`,
          ),
        )
      : null,
    h("button", { type: "button", disabled: busy, onClick: props.onReload }, "Reload policy"),
  );
}
