import { createElement, useEffect, useRef } from "react";
import type {
  PageExperienceReport,
  PageExperienceRatio,
  importGa4Engagement,
} from "@croco/metrics-core";
export type PageExperiencePanelState =
  | { kind: "loading" | "denied" | "error" | "unavailable" | "empty" }
  | {
      kind: "ready" | "partial";
      report: PageExperienceReport;
      ga4?: ReturnType<typeof importGa4Engagement>;
    };
export function PageExperiencePanel({
  state,
  onRefresh,
}: {
  state: PageExperiencePanelState;
  onRefresh: () => void;
}) {
  const refreshButton = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  useEffect(() => {
    const button = refreshButton.current;
    if (state.kind !== "loading" && restoreFocus.current && button) {
      if (
        button.ownerDocument.activeElement === button.ownerDocument.body ||
        button.ownerDocument.activeElement === button
      )
        button.focus();
      restoreFocus.current = false;
    }
  }, [state.kind]);
  const ratio = (value: PageExperienceRatio) =>
    `${value.numerator} / ${value.denominator} · ${value.value === null ? "Unknown" : `${(100 * value.value).toFixed(1)}%`}${value.unobserved ? ` · ${value.unobserved} unobserved` : ""}`;
  const notices = {
    loading: "Loading page experience…",
    denied: "You do not have permission to read this scope.",
    error: "Source failed. No report is available.",
    unavailable: "Observation evidence is unavailable.",
    empty: "No page views in this cohort.",
  };
  const loaded = state.kind === "ready" || state.kind === "partial";
  return createElement(
    "section",
    {
      "aria-label": "Page experience",
      style: {
        maxWidth: "64rem",
        margin: "auto",
        padding: "1rem",
        fontFamily: "system-ui",
        overflowWrap: "anywhere",
      },
    },
    createElement("h1", null, "Page experience"),
    createElement(
      "p",
      null,
      "Custom engagement and ordered value actions. Observation differences do not establish causes.",
    ),
    createElement(
      "button",
      {
        type: "button",
        ref: refreshButton,
        onClick: () => {
          restoreFocus.current =
            refreshButton.current?.ownerDocument.activeElement === refreshButton.current;
          onRefresh();
        },
        disabled: state.kind === "loading",
      },
      "Refresh report",
    ),
    !loaded
      ? createElement(
          "p",
          { role: state.kind === "error" || state.kind === "denied" ? "alert" : "status" },
          notices[state.kind as keyof typeof notices],
        )
      : createElement(
          "div",
          null,
          createElement(
            "p",
            { role: "status" },
            `${state.kind === "partial" ? "Partial observation. " : ""}Unit: ${state.report.unit}. Definition: ${state.report.definition.id} v${state.report.definition.version}. Timezone: ${state.report.definition.timezone}.`,
          ),
          createElement(
            "p",
            null,
            `Session cohort [${state.report.window.from}, ${state.report.window.to}). Cutoff: ${state.report.cutoff}.`,
          ),
          createElement(
            "dl",
            null,
            ...[
              ["Observed views", String(state.report.viewed)],
              ["Engaged", ratio(state.report.engaged)],
              ["Attempted after engagement", ratio(state.report.attempted)],
              ["Confirmed after attempt", ratio(state.report.committed)],
              ["Confirmed domain outcomes", String(state.report.confirmedOutcomes)],
              ["Unlinked confirmed outcomes", String(state.report.unlinkedCommitted)],
              ["Custom bounce", ratio(state.report.bounce)],
              ["Complete sessions", String(state.report.completeSessions)],
              ["Open sessions", String(state.report.openSessions)],
              ["Unknown sessions", String(state.report.unknownSessions)],
            ].flatMap(([title, value]) => [
              createElement(
                "dt",
                { key: `${title}-term`, style: { fontWeight: 600, marginTop: "1rem" } },
                title,
              ),
              createElement("dd", { key: `${title}-value`, style: { margin: 0 } }, value),
            ]),
          ),
          createElement(
            "p",
            null,
            `Source revision: ${state.report.sourceRevision}. Snapshot: ${state.report.snapshotRef}. Report: ${state.report.revision}.`,
          ),
          createElement(
            "p",
            null,
            `Definition hash: ${state.report.definitionHash}. Input hash: ${state.report.inputHash}.`,
          ),
          state.ga4
            ? createElement(
                "aside",
                { "aria-label": "Separate GA4 definition" },
                createElement("h2", null, "GA4 session engagement"),
                createElement(
                  "p",
                  null,
                  `${state.ga4.engagedSessions} / ${state.ga4.sessionDenominator} engaged sessions. Provider definition ${state.ga4.definitionVersion}; settings ${state.ga4.settingsVersion}; source ${state.ga4.sourceRevision}. This is a separate population and definition.`,
                ),
                createElement(
                  "p",
                  null,
                  `GA4 bounce: ${ratio(state.ga4.bounce)}. Window [${state.ga4.window.from}, ${state.ga4.window.to}); timezone ${state.ga4.timezone}; filter reference ${state.ga4.filters}.`,
                ),
              )
            : null,
        ),
  );
}
