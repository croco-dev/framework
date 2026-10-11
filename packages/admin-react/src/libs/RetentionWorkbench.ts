import { createElement } from "react";
import type { ReactElement } from "react";
import type {
  RetentionWorkbenchState,
  RetentionDrilldownPage,
  RetentionMetricCard,
} from "@croco/admin-core";

export type RetentionWorkbenchProps = {
  state: RetentionWorkbenchState;
  onSelectMetric: (selectionId: string, inputToken: string) => void;
  drilldown?: RetentionDrilldownPage;
  drilldownState?: "loading" | "denied" | "error" | "stale";
  onReload: () => void;
  onNextPage?: (selectionId: string, offset: number, inputToken: string) => void;
};
const metricNames = {
  periodic: "Periodic retention",
  cohort: "First behavior cohort retention",
  frequency: "Activity frequency",
};
function table(label: string, headers: string[], rows: ReactElement[]) {
  return createElement(
    "div",
    {
      role: "region",
      "aria-label": `${label} scroll area`,
      tabIndex: 0,
      style: { maxWidth: "100%", overflowX: "auto" },
    },
    createElement(
      "table",
      { "aria-label": label, style: { whiteSpace: "nowrap" } },
      createElement(
        "thead",
        null,
        createElement(
          "tr",
          null,
          ...headers.map((header) => createElement("th", { key: header, scope: "col" }, header)),
        ),
      ),
      createElement("tbody", null, ...rows),
    ),
  );
}
function cardView(card: RetentionMetricCard, onSelect: (id: string) => void) {
  return createElement(
    "article",
    {
      key: card.id,
      "aria-label": `${metricNames[card.kind]} ${card.id}`,
      "data-availability": card.availability,
    },
    createElement("h3", null, `${metricNames[card.kind]} · ${card.id}`),
    createElement("p", null, `Observation: [${card.window.from}, ${card.window.to})`),
    card.baselineWindow
      ? createElement(
          "p",
          null,
          `Baseline: [${card.baselineWindow.from}, ${card.baselineWindow.to})`,
        )
      : null,
    createElement(
      "p",
      null,
      `Availability: ${card.availability}${card.reason ? ` · ${card.reason}` : ""}`,
    ),
    createElement(
      "button",
      {
        type: "button",
        onClick: () => onSelect(card.id),
        "aria-label": `Inspect denominator for ${card.id}`,
      },
      `${card.numerator} / ${card.denominator} · ${card.value === null ? "Not established" : card.value.toLocaleString(undefined, { style: "percent", maximumFractionDigits: 1 })}`,
    ),
    createElement(
      "p",
      null,
      `Definition: ${card.definitionId}@${card.definitionVersion} · Sources: ${card.sources.join(", ")}`,
    ),
    card.buckets
      ? table(
          `Frequency distribution ${card.id}`,
          [
            card.measure === "activeDays" ? "Active days" : "Action count",
            "Subjects",
            "Denominator",
            "Distribution",
          ],
          card.buckets.map((bucket) =>
            createElement(
              "tr",
              { key: bucket.frequency },
              createElement("td", null, bucket.frequency),
              createElement("td", null, bucket.numerator),
              createElement("td", null, bucket.denominator),
              createElement(
                "td",
                null,
                createElement("meter", {
                  min: 0,
                  max: bucket.denominator,
                  value: bucket.numerator,
                  "aria-label": `${bucket.frequency}: ${bucket.numerator} of ${bucket.denominator}`,
                }),
                bucket.value === null
                  ? "Not established"
                  : bucket.value.toLocaleString(undefined, { style: "percent" }),
              ),
            ),
          ),
        )
      : null,
  );
}
export function RetentionWorkbench({
  state,
  onSelectMetric,
  drilldown,
  drilldownState,
  onNextPage,
  onReload,
}: RetentionWorkbenchProps): ReactElement {
  if (state.kind === "loading")
    return createElement(
      "section",
      { "aria-label": "Retention workbench", "data-state": state.kind, "aria-busy": true },
      createElement("p", { role: "status" }, "Loading retention"),
    );
  if (state.kind === "denied" || state.kind === "error")
    return createElement(
      "section",
      { "aria-label": "Retention workbench", "data-state": state.kind },
      createElement(
        "p",
        { role: "alert" },
        `${state.kind === "denied" ? "Access denied" : "Retention failed"}: ${state.code}`,
      ),
      state.kind === "error"
        ? createElement("button", { type: "button", onClick: onReload }, "Reload retention")
        : null,
    );
  const { snapshot } = state;
  return createElement(
    "section",
    { "aria-label": "Retention workbench", "data-state": state.kind },
    createElement("h2", null, "Retention workbench"),
    createElement(
      "p",
      null,
      `${snapshot.definition.id}@${snapshot.definition.version} · ${snapshot.definition.subjectKind} · ${snapshot.definition.timezone}`,
    ),
    createElement(
      "p",
      null,
      `${snapshot.scope.appId} / ${snapshot.scope.environment} / ${snapshot.scope.tenantId}`,
    ),
    createElement(
      "p",
      null,
      `Complete through: ${snapshot.completeThrough ?? "Unknown"} · Known history from: ${snapshot.knownHistoryFrom ?? "Unknown"} · Deleted subjects: ${snapshot.definition.deletedSubjectPolicy}`,
    ),
    createElement(
      "p",
      { role: "status" },
      state.kind === "empty"
        ? "No denominator subjects in the observed windows."
        : state.kind === "provisional"
          ? "Observation is incomplete. Values are provisional."
          : state.kind === "insufficient"
            ? "History is insufficient to establish retention."
            : "Observed retention results",
    ),
    ...(["periodic", "cohort"] as const).map((kind) => {
      const cells = snapshot.cards.filter((card) => card.kind === kind);
      if (cells.length === 0) return null;
      return createElement(
        "section",
        { key: kind, "aria-label": kind === "periodic" ? "Retention trend" : "Cohort cells" },
        createElement("h3", null, kind === "periodic" ? "Retention trend" : "Cohort cells"),
        table(
          kind === "periodic" ? "Periodic retention by window" : "First behavior cohort by window",
          ["Baseline", "Returning window", "Retained / baseline", "Retention", "Observation"],
          cells.map((card) =>
            createElement(
              "tr",
              { key: card.id },
              createElement(
                "td",
                null,
                card.baselineWindow
                  ? `${card.baselineWindow.from} – ${card.baselineWindow.to}`
                  : "Unknown",
              ),
              createElement("td", null, `${card.window.from} – ${card.window.to}`),
              createElement(
                "td",
                null,
                createElement(
                  "button",
                  {
                    type: "button",
                    onClick: () => onSelectMetric(card.id, snapshot.inputToken),
                    "aria-label": `Inspect cell ${card.id}`,
                  },
                  `${card.numerator} / ${card.denominator}`,
                ),
              ),
              createElement(
                "td",
                null,
                card.value === null
                  ? "Not established"
                  : card.value.toLocaleString(undefined, {
                      style: "percent",
                      maximumFractionDigits: 1,
                    }),
              ),
              createElement("td", null, card.availability),
            ),
          ),
        ),
      );
    }),
    ...snapshot.cards.map((card) =>
      cardView(card, (id) => onSelectMetric(id, snapshot.inputToken)),
    ),
    drilldownState === "stale" || (drilldown && drilldown.inputToken !== snapshot.inputToken)
      ? createElement(
          "section",
          { role: "alert" },
          createElement(
            "p",
            null,
            "Retention input changed. Reload results before inspecting subjects.",
          ),
          createElement("button", { type: "button", onClick: onReload }, "Reload retention"),
        )
      : drilldownState
        ? createElement(
            "p",
            { role: drilldownState === "loading" ? "status" : "alert" },
            `Denominator ${drilldownState}`,
          )
        : drilldown
          ? createElement(
              "section",
              { "aria-label": "Denominator inspection", "aria-live": "polite" },
              createElement("h3", null, `Denominator: ${drilldown.selectionId}`),
              table(
                "Subject inclusion and exclusion",
                ["Subject", "In denominator", "In numerator", "Reason", "Actions", "Active days"],
                drilldown.rows.map((row) =>
                  createElement(
                    "tr",
                    { key: row.subjectLabel },
                    ...[
                      row.subjectLabel,
                      row.inDenominator ? "Yes" : "No",
                      row.inNumerator ? "Yes" : "No",
                      row.reason,
                      row.count,
                      row.activeDays,
                    ].map((value, index) => createElement("td", { key: index }, value)),
                  ),
                ),
              ),
              createElement("p", null, `${drilldown.rows.length} shown of ${drilldown.total}`),
              drilldown.nextOffset !== null && onNextPage
                ? createElement(
                    "button",
                    {
                      type: "button",
                      onClick: () => {
                        if (drilldown.nextOffset !== null)
                          onNextPage(
                            drilldown.selectionId,
                            drilldown.nextOffset,
                            drilldown.inputToken,
                          );
                      },
                    },
                    "Next subjects",
                  )
                : null,
            )
          : null,
  );
}
