import { createElement as h, useState, useEffect, useRef } from "react";
import type { ChangeEvent, FormEvent, ReactElement } from "react";
import type {
  NetOutcomeRequest,
  NetOutcomeState,
  NetOutcomeDrilldown,
  NetOutcomeDrilldownRequest,
} from "@croco/admin-core";
export type NetOutcomePanelProps = {
  state: NetOutcomeState;
  request: NetOutcomeRequest;
  onRefresh(request: NetOutcomeRequest): Promise<void>;
  onDrilldown?: (request: NetOutcomeDrilldownRequest) => Promise<NetOutcomeDrilldown>;
};
const DRILLDOWN_PAGE_LIMIT = 20;
const rational = (value: { numerator: string; denominator: string } | null) =>
  value
    ? `${value.numerator} / ${value.denominator}`
    : "Unavailable (see completeness and diagnostics)";
export function NetOutcomePanel({
  state,
  request,
  onRefresh,
  onDrilldown,
}: NetOutcomePanelProps): ReactElement {
  const [effectiveAt, setEffectiveAt] = useState(request.cutoff.effectiveAt);
  const [knownAt, setKnownAt] = useState(request.cutoff.knownAt);
  const [revision, setRevision] = useState(request.revision);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const [detail, setDetail] = useState<NetOutcomeDrilldown>();
  const generation = useRef(0);
  const operationSequence = useRef(0);
  const activeOperation = useRef<"refresh" | "drilldown" | undefined>(undefined);
  useEffect(() => {
    generation.current++;
    setDetail(undefined);
    if (activeOperation.current === "drilldown") {
      operationSequence.current++;
      activeOperation.current = undefined;
      setPending(false);
      setError(false);
    }
  }, [state, request]);
  useEffect(() => {
    setEffectiveAt(request.cutoff.effectiveAt);
    setKnownAt(request.cutoff.knownAt);
    setRevision(request.revision);
  }, [request.cutoff.effectiveAt, request.cutoff.knownAt, request.revision]);
  const snapshot = "snapshot" in state ? state.snapshot : undefined;
  const run = async (action: () => Promise<void>, kind: "refresh" | "drilldown") => {
    const sequence = ++operationSequence.current;
    activeOperation.current = kind;
    setPending(true);
    setError(false);
    setDetail(undefined);
    try {
      await action();
    } catch {
      if (sequence === operationSequence.current) setError(true);
    } finally {
      if (sequence === operationSequence.current) {
        activeOperation.current = undefined;
        setPending(false);
      }
    }
  };
  const field = (label: string, value: string, update: (value: string) => void) =>
    h(
      "label",
      { style: { display: "block", marginBottom: 12 } },
      label,
      h("input", {
        required: true,
        value,
        onChange: (event: ChangeEvent<HTMLInputElement>) => update(event.target.value),
        style: { display: "block", width: "100%", boxSizing: "border-box" },
      }),
    );
  return h(
    "section",
    {
      "aria-label": "Assigned net outcomes",
      "aria-busy": pending || state.kind === "loading",
      "data-state": state.kind,
      style: { maxWidth: 1000, margin: "auto", padding: 24, overflowWrap: "anywhere" },
    },
    h("h1", null, "Assigned net outcomes"),
    h(
      "p",
      null,
      "Descriptive comparison per assigned unit. This report does not establish causal uplift.",
    ),
    h(
      "form",
      {
        onSubmit: (event: FormEvent) => {
          event.preventDefault();
          void run(() => onRefresh({ cutoff: { effectiveAt, knownAt }, revision }), "refresh");
        },
      },
      h(
        "fieldset",
        { disabled: pending || state.kind === "loading" },
        h("legend", null, "Report cutoffs"),
        field("Effective cutoff", effectiveAt, setEffectiveAt),
        field("Known cutoff", knownAt, setKnownAt),
        field("Revision", revision, setRevision),
        h("button", { type: "submit" }, "Refresh report"),
      ),
    ),
    error
      ? h(
          "p",
          { role: "alert" },
          "Operation failed. Review the cutoffs and revision, then refresh.",
        )
      : null,
    pending || state.kind === "loading" ? h("p", { role: "status" }, "Loading report…") : null,
    state.kind === "denied" ? h("p", { role: "alert" }, `Access denied (${state.code}).`) : null,
    state.kind === "error"
      ? h("p", { role: "alert" }, `Report failed (${state.code}). Refresh to retry.`)
      : null,
    state.kind === "empty"
      ? h("p", { role: "status" }, "No report at these cutoffs and revision.")
      : null,
    state.kind === "partial"
      ? h(
          "p",
          { role: "status" },
          "Partial report: missing or pending inputs remain visible below.",
        )
      : null,
    snapshot
      ? h(
          "div",
          null,
          h("h2", null, "Report provenance"),
          h(
            "p",
            null,
            `Snapshot ${snapshot.assignmentSnapshot.id} · Unit ${snapshot.assignmentSnapshot.unit} · Revision ${snapshot.revision}`,
          ),
          h(
            "p",
            null,
            `Effective ${snapshot.cutoff.effectiveAt} · Known ${snapshot.cutoff.knownAt}`,
          ),
          h(
            "p",
            null,
            `Definition ${snapshot.metricDefinitionVersion} · Hash ${snapshot.definitionHash}`,
          ),
          h("p", null, `Input hash ${snapshot.inputHash}`),
          h("p", null, `Sources: ${snapshot.sources.join(", ")}`),
          ...snapshot.byCurrency.map((group) =>
            h(
              "section",
              { key: group.currency, "aria-label": group.currency },
              h("h2", null, `${group.currency} · minor units`),
              ...group.arms.map((arm) =>
                h(
                  "article",
                  {
                    key: arm.arm,
                    style: { border: "1px solid #aaa", padding: 16, marginBottom: 16 },
                  },
                  h("h3", null, arm.arm),
                  h("p", null, `Assigned denominator: ${arm.assignedUnits}`),
                  h(
                    "p",
                    null,
                    `Payment ${arm.components.payment} − Refund ${arm.components.refund} − Cashback ${arm.components.cashback} − Direct contact cost ${arm.components.direct_contact_cost}`,
                  ),
                  h(
                    "p",
                    null,
                    `Net: ${arm.netMinor} · Per assigned unit: ${rational(arm.perUnit)}`,
                  ),
                  h("p", null, `Noncash face value (separate): ${arm.components.noncash_grant}`),
                  h(
                    "p",
                    null,
                    `Refund rate: ${rational(arm.refundRate)} · Denominator: paying assigned subjects`,
                  ),
                  h(
                    "p",
                    null,
                    `Retention rate: ${rational(arm.retentionRate)} · Denominator: assigned units`,
                  ),
                  ...group.delta
                    .filter((delta) => delta.arm === arm.arm)
                    .map((delta) =>
                      h(
                        "p",
                        { key: delta.baselineArm },
                        `Delta versus ${delta.baselineArm}: ${rational(delta.value)}`,
                      ),
                    ),
                  ...snapshot.costCompleteness
                    .filter((cost) => cost.arm === arm.arm && cost.currency === group.currency)
                    .map((cost) =>
                      h(
                        "p",
                        { key: `${cost.source}/${cost.kind}` },
                        `${cost.source} / ${cost.kind}: ${cost.status}${cost.pendingCount === undefined ? "" : ` (${cost.pendingCount} pending)`}`,
                      ),
                    ),
                  onDrilldown
                    ? snapshot.sources.map((source) =>
                        h(
                          "button",
                          {
                            key: source,
                            type: "button",
                            disabled: pending,
                            onClick: () => {
                              const current = generation.current;
                              void run(async () => {
                                const page = await onDrilldown({
                                  cutoff: snapshot.cutoff,
                                  revision: snapshot.revision,
                                  arm: arm.arm,
                                  currency: group.currency,
                                  source,
                                  limit: DRILLDOWN_PAGE_LIMIT,
                                });
                                if (current === generation.current) setDetail(page);
                              }, "drilldown");
                            },
                          },
                          `Inspect ${arm.arm} / ${group.currency} / ${source}`,
                        ),
                      )
                    : null,
                ),
              ),
            ),
          ),
          h(
            "p",
            null,
            `Diagnostics: ${snapshot.diagnostics.map((entry) => entry.code).join(", ") || "none"}`,
          ),
          detail
            ? h(
                "section",
                { "aria-label": "Masked event details" },
                h("h2", null, "Masked event details"),
                h("p", null, detail.assumptions.join(" · ")),
                h(
                  "p",
                  null,
                  detail.truncated
                    ? `Page limited to ${DRILLDOWN_PAGE_LIMIT} rows.`
                    : "Complete page.",
                ),
                h(
                  "ul",
                  null,
                  ...detail.rows.map((row, index) =>
                    h(
                      "li",
                      { key: index },
                      `${row.kind} · ${row.occurredAt} · ${row.maskedReference}`,
                    ),
                  ),
                ),
              )
            : null,
        )
      : null,
  );
}
