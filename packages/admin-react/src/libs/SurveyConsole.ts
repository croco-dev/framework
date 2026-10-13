import { createElement as h, useState } from "react";
import { SurveyCard } from "@croco/frontend-react/surveys";
import { validateSurveyDefinition, SurveyInvalidProblem } from "@croco/research-core";
import { validateSurveyPublishRequest } from "@croco/admin-core/survey-operations";
import type { ChangeEvent, ReactElement } from "react";
import type { SurveyAnswers, SurveyDefinition, SurveyResponse } from "@croco/research-core";
import type { SurveyAdminAccess, SurveyPublishRequest } from "@croco/admin-core/survey-operations";

export type SurveyEditorProps = Readonly<{
  access: SurveyAdminAccess;
  definition: SurveyDefinition;
  revision: number;
  onPublish(request: SurveyPublishRequest): Promise<void>;
}>;
export function SurveyEditor(props: SurveyEditorProps): ReactElement {
  return h(Editor, {
    ...props,
    key: JSON.stringify([
      props.access.scope,
      props.definition.id,
      props.definition.version,
      props.revision,
    ]),
  });
}
function Editor(props: SurveyEditorProps): ReactElement {
  const [text, setText] = useState(JSON.stringify(props.definition, null, 2));
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState<SurveyDefinition>();
  const [feedback, setFeedback] = useState("");
  const [pending, setPending] = useState(false);
  const [key, setKey] = useState(() => crypto.randomUUID());
  const parse = () => {
    const value: SurveyDefinition = JSON.parse(text);
    validateSurveyDefinition(value);
    return value;
  };
  return h(
    "section",
    { "aria-label": "Survey editor" },
    h("h2", null, "Survey editor"),
    h("p", { role: "status" }, `Current publication revision: ${props.revision}`),
    h(
      "p",
      null,
      "Publish a new version for question or option changes. Frequency is counted across versions within the same family. Target and trigger names must be registered by the application.",
    ),
    h(
      "label",
      null,
      "Definition (questions, options, period, target and frequency)",
      h("textarea", {
        "aria-label": "Survey definition",
        rows: 20,
        value: text,
        disabled: pending,
        style: { width: "100%", boxSizing: "border-box" },
        onChange: (e: ChangeEvent<HTMLTextAreaElement>) => {
          setText(e.target.value);
          setPreview(undefined);
          setKey(crypto.randomUUID());
        },
      }),
    ),
    h(
      "label",
      null,
      "Reason",
      h("input", {
        "aria-label": "Publication reason",
        value: reason,
        disabled: pending,
        onChange: (e: ChangeEvent<HTMLInputElement>) => {
          setReason(e.target.value);
          setKey(crypto.randomUUID());
        },
      }),
    ),
    h(
      "button",
      {
        type: "button",
        disabled: pending,
        onClick: () => {
          try {
            setPreview(parse());
            setFeedback("");
          } catch (e) {
            setFeedback(e instanceof Error ? e.message : "Invalid definition");
          }
        },
      },
      "Preview survey",
    ),
    h(
      "button",
      {
        type: "button",
        disabled: pending || !props.access.permissions.includes("publish"),
        onClick: async () => {
          try {
            const request = {
              definition: parse(),
              expectedRevision: props.revision,
              reason,
              idempotencyKey: key,
            };
            validateSurveyPublishRequest(request);
            setPending(true);
            await props.onPublish(request);
            setFeedback("Survey published.");
          } catch (e) {
            setFeedback(e instanceof Error ? e.message : "Publication failed");
          } finally {
            setPending(false);
          }
        },
      },
      "Publish survey",
    ),
    h("p", { role: "status" }, feedback),
    preview && h(SurveyPreview, { definition: preview }),
  );
}
export function SurveyPreview(props: { definition: SurveyDefinition }): ReactElement {
  return h(SurveyCard, {
    definition: props.definition,
    identity: JSON.stringify(props.definition),
    preview: true,
    onSubmit: async (_answers: SurveyAnswers) => undefined,
    onDismiss: async () => undefined,
  });
}
export type SurveyResultsData = Readonly<{
  invitations: number;
  exposures: number;
  dismissed: number;
  submitted: number;
  unexposed: number;
  unanswered: number;
  denominator: number;
  denominatorKind: "invitation" | "exposure";
  responseRate: number | null;
}>;
export type SurveyResultsState =
  | { kind: "loading" | "empty" | "denied" }
  | { kind: "error"; message: string }
  | {
      kind: "ready" | "partial";
      data: SurveyResultsData;
      responses?: readonly SurveyResponse[];
      message?: string;
    };
export type SurveyResultsProps = Readonly<{
  state: SurveyResultsState;
  onDenominatorChange(value: "invitation" | "exposure"): void;
  onDelete?(response: SurveyResponse, reason: string): Promise<void>;
  onClassify?(response: SurveyResponse, classification: string, reason: string): Promise<void>;
  onNextPage?(): void;
}>;
export function SurveyResults(props: SurveyResultsProps): ReactElement {
  const s = props.state;
  if (s.kind === "loading") return h("p", { role: "status" }, "Loading survey results…");
  if (s.kind === "denied") return h("p", { role: "alert" }, "Survey results access denied.");
  if (s.kind === "empty") return h("p", null, "No published survey.");
  if (s.kind === "error") return h("p", { role: "alert" }, s.message);
  if (s.kind !== "ready" && s.kind !== "partial") return h("p", null, "Results unavailable.");
  return h(
    "section",
    { "aria-label": "Survey results" },
    h("h2", null, "Survey results"),
    h(
      "p",
      null,
      "Respondents are a selected sample. Results do not establish customer-wide sentiment or causes.",
    ),
    s.kind === "partial" && h("p", { role: "alert" }, s.message ?? "Some results are unavailable."),
    h(
      "label",
      null,
      "Response-rate denominator",
      h(
        "select",
        {
          "aria-label": "Response-rate denominator",
          value: s.data.denominatorKind,
          onChange: (e: ChangeEvent<HTMLSelectElement>) =>
            props.onDenominatorChange(e.target.value as "invitation" | "exposure"),
        },
        h("option", { value: "invitation" }, "Invitations"),
        h("option", { value: "exposure" }, "Actual exposures"),
      ),
    ),
    h(
      "dl",
      null,
      [
        ["Invitations", s.data.invitations],
        ["Actual exposures", s.data.exposures],
        ["Not exposed", s.data.unexposed],
        ["Skipped", s.data.dismissed],
        ["Submitted responses", s.data.submitted],
        ["Exposed without a response", s.data.unanswered],
        ["Selected denominator", s.data.denominator],
        [
          "Response rate",
          s.data.responseRate === null
            ? "Unavailable"
            : `${(s.data.responseRate * 100).toFixed(1)}%`,
        ],
      ].map(([label, value]) =>
        h("div", { key: label }, h("dt", null, String(label)), h("dd", null, String(value))),
      ),
    ),
    s.responses?.map((r) =>
      h(ResponseRow, {
        key: JSON.stringify([r.id, r.revision]),
        response: r,
        onDelete: props.onDelete,
        onClassify: props.onClassify,
      }),
    ),
    props.onNextPage &&
      h("button", { type: "button", onClick: props.onNextPage }, "Next response page"),
  );
}
function ResponseRow(props: {
  response: SurveyResponse;
  onDelete?: SurveyResultsProps["onDelete"];
  onClassify?: SurveyResultsProps["onClassify"];
}): ReactElement {
  const [reason, setReason] = useState("");
  const [classification, setClassification] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const r = props.response;
  async function act(remove: boolean) {
    try {
      if (!reason.trim()) throw new SurveyInvalidProblem("Reason is required");
      setBusy(true);
      if (remove) await props.onDelete?.(r, reason);
      else await props.onClassify?.(r, classification, reason);
      setMessage("Saved.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Operation failed");
    } finally {
      setBusy(false);
    }
  }
  return h(
    "article",
    { "aria-label": `Response revision ${r.revision}`, style: { overflowWrap: "anywhere" } },
    h("h3", null, `Response revision ${r.revision}`),
    r.deletedAt
      ? h("p", null, "Raw response deleted or retention expired.")
      : h("pre", { style: { whiteSpace: "pre-wrap" } }, JSON.stringify(r.answers, null, 2)),
    h("p", null, `Human classification: ${r.classification ?? "Unclassified"}`),
    !r.deletedAt &&
      h(
        "div",
        null,
        h(
          "label",
          null,
          "Operation reason",
          h("input", {
            value: reason,
            onChange: (e: ChangeEvent<HTMLInputElement>) => setReason(e.target.value),
          }),
        ),
        props.onClassify &&
          h(
            "label",
            null,
            "Human classification",
            h("input", {
              value: classification,
              onChange: (e: ChangeEvent<HTMLInputElement>) => setClassification(e.target.value),
            }),
          ),
        props.onClassify &&
          h(
            "button",
            { type: "button", disabled: busy, onClick: () => void act(false) },
            "Save classification",
          ),
        props.onDelete &&
          h(
            "button",
            { type: "button", disabled: busy, onClick: () => void act(true) },
            "Delete raw response",
          ),
      ),
    h("p", { role: "status" }, message),
  );
}
