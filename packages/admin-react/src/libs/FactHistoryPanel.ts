import { createElement as h, useState } from "react";
import {
  validateFactHistoryComparison,
  validateFactHistoryCorrection,
} from "@croco/admin-core/fact-history-validation";
import type { ChangeEvent, FormEvent, ReactElement } from "react";
import type {
  FactHistoryComparisonRequest,
  FactHistoryCorrectionRequest,
  FactHistoryState,
} from "@croco/admin-core";

export type FactHistoryPanelProps = {
  readonly state: FactHistoryState;
  readonly request: FactHistoryComparisonRequest;
  readonly actor: string;
  readonly canCorrect: boolean;
  readonly onCompare: (request: FactHistoryComparisonRequest) => Promise<void>;
  readonly onCorrect: (request: FactHistoryCorrectionRequest) => Promise<void>;
};

export function FactHistoryPanel({
  state,
  request,
  actor,
  canCorrect,
  onCompare,
  onCorrect,
}: FactHistoryPanelProps): ReactElement {
  const [times, setTimes] = useState({
    effectiveAt: request.effectiveAt,
    knownAt: request.knownAt,
    compareEffectiveAt: request.compareEffectiveAt,
    compareKnownAt: request.compareKnownAt,
  });
  const [reason, setReason] = useState("");
  const [source, setSource] = useState("");
  const [value, setValue] = useState("");
  const [rowId, setRowId] = useState("");
  const [key, setKey] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const snapshot = "snapshot" in state ? state.snapshot : undefined;
  const run = async (action: () => Promise<void>) => {
    setPending(true);
    setError(undefined);
    try {
      await action();
    } catch (failure) {
      setError(
        failure instanceof Error && "code" in failure && typeof failure.code === "string"
          ? `Operation failed (${failure.code}). Review the inputs and compare again.`
          : "Operation failed. Review the inputs and compare again.",
      );
    } finally {
      setPending(false);
    }
  };
  const field = (label: string, current: string, update: (value: string) => void) =>
    h(
      "label",
      { key: label, style: { display: "block", marginBottom: "0.75rem" } },
      label,
      h("input", {
        "aria-label": label,
        required: true,
        value: current,
        onChange: (event: ChangeEvent<HTMLInputElement>) => update(event.target.value),
        style: { display: "block", width: "100%", boxSizing: "border-box" },
      }),
    );
  return h(
    "section",
    {
      "aria-label": "Fact history",
      "aria-busy": pending || state.kind === "loading",
      "data-state": state.kind,
      style: { maxWidth: "64rem", padding: "1rem", overflowWrap: "anywhere" },
    },
    h("h2", null, "Fact history"),
    h(
      "p",
      null,
      `${request.scope.app} / ${request.scope.environment} / ${request.scope.tenantId ?? "application scope"} · ${request.subject.kind}:${request.subject.id} · ${request.definitionId}`,
    ),
    h(
      "form",
      {
        onSubmit: (event: FormEvent) => {
          event.preventDefault();
          void run(async () => {
            const next = { ...request, ...times };
            validateFactHistoryComparison(next);
            await onCompare(next);
          });
        },
      },
      h(
        "fieldset",
        { disabled: pending || state.kind === "loading" || state.kind === "denied" },
        h("legend", null, "Compare effective and known times"),
        ...(["effectiveAt", "knownAt", "compareEffectiveAt", "compareKnownAt"] as const).map(
          (name) =>
            field(
              {
                effectiveAt: "First effective time",
                knownAt: "First known time",
                compareEffectiveAt: "Second effective time",
                compareKnownAt: "Second known time",
              }[name],
              times[name],
              (next) => setTimes({ ...times, [name]: next }),
            ),
        ),
        h("p", null, `Read limit: ${request.limit} rows. Use ISO 8601 times with a timezone.`),
        h("button", { type: "submit" }, "Compare history"),
      ),
    ),
    error ? h("p", { role: "alert" }, error) : null,
    state.kind === "loading" ? h("p", { role: "status" }, "Loading history…") : null,
    state.kind === "denied" ? h("p", { role: "alert" }, `Access denied (${state.code}).`) : null,
    state.kind === "error"
      ? h(
          "p",
          { role: "alert" },
          `History could not be read (${state.code}). Compare again to retry.`,
        )
      : null,
    state.kind === "empty"
      ? h("p", { role: "status" }, "No history at these times. The past value is unknown.")
      : null,
    state.kind === "partial"
      ? h(
          "p",
          { role: "status" },
          "History display is limited. Comparison uses the canonical history service.",
        )
      : null,
    snapshot
      ? h(
          "div",
          null,
          h(
            "section",
            { "aria-label": "Time comparison" },
            h("h3", null, "Time comparison"),
            ...(
              [
                ["First", snapshot.before],
                ["Second", snapshot.after],
              ] as const
            ).map(([label, point]) =>
              h(
                "article",
                { key: label },
                h("h4", null, label),
                h(
                  "p",
                  null,
                  `${point.status}${point.value === undefined ? "" : `: ${point.value}`}`,
                ),
                h("p", null, `Provenance: ${point.provenance.join(", ") || "none"}`),
              ),
            ),
          ),
          snapshot.decisionSnapshot
            ? h(
                "section",
                { "aria-label": "Decision snapshot" },
                h("h3", null, `Decision snapshot ${snapshot.decisionSnapshot.id}`),
                h("p", null, snapshot.decisionSnapshot.evidence.join(", ")),
              )
            : null,
          h("h3", null, "Source and revision history"),
          h(
            "ol",
            null,
            ...snapshot.rows.map((row) =>
              h(
                "li",
                { key: row.id },
                h("strong", null, row.value),
                h("p", null, `Source: ${row.source} / ${row.sourceEventId}`),
                h(
                  "p",
                  null,
                  `Valid: [${row.validFrom}, ${row.validTo ?? "open"}) · Recorded: ${row.recordedAt}`,
                ),
                h(
                  "p",
                  null,
                  `Definition: ${row.definitionVersion} · Projection: ${row.projectionId}/${row.projectionRowKey} · Revision: ${row.materializationRevision} · Supersedes: ${row.supersedes ?? "none"}`,
                ),
                canCorrect
                  ? h(
                      "button",
                      {
                        type: "button",
                        disabled: pending,
                        onClick: () => {
                          setRowId(row.id);
                          setValue(row.value);
                          setKey("");
                        },
                      },
                      `Correct ${row.id}`,
                    )
                  : null,
              ),
            ),
          ),
          canCorrect && rowId
            ? h(
                "form",
                {
                  "aria-label": "Append correction",
                  onSubmit: (event: FormEvent) => {
                    event.preventDefault();
                    void run(async () => {
                      const correction: FactHistoryCorrectionRequest = {
                        scope: request.scope,
                        subject: request.subject,
                        definitionId: request.definitionId,
                        definitionVersion: request.definitionVersion,
                        materializationRevision: request.materializationRevision,
                        rowId,
                        actor,
                        reason,
                        source,
                        value: JSON.parse(value),
                        validFrom: times.compareEffectiveAt,
                        expectedRevision: snapshot.revision,
                        idempotencyKey: key,
                      };
                      validateFactHistoryCorrection(correction);
                      await onCorrect(correction);
                      setRowId("");
                    });
                  },
                },
                h(
                  "fieldset",
                  { disabled: pending },
                  h("legend", null, "Append correction"),
                  h(
                    "p",
                    null,
                    `Actor: ${actor} · Expected revision: ${snapshot.revision} · Replaces: ${rowId}`,
                  ),
                  field("Value (JSON)", value, setValue),
                  field("Reason", reason, setReason),
                  field("Source", source, setSource),
                  field("Idempotency key", key, setKey),
                  h("button", { type: "submit" }, "Append correction"),
                ),
              )
            : null,
        )
      : null,
  );
}
