import { createElement, useEffect, useRef } from "react";
import type { AcquisitionInspectorState } from "@croco/admin-core/acquisition";

export type AcquisitionInspectorProps = {
  readonly state: AcquisitionInspectorState;
  readonly onRefresh: () => void;
};
/** Consumes authorized, masked results of the shared acquisition engine. */
export function AcquisitionInspector({ state, onRefresh }: AcquisitionInspectorProps) {
  const refreshButton = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  useEffect(() => {
    const button = refreshButton.current;
    if (state.kind !== "loading" && restoreFocus.current && button) {
      const document = button.ownerDocument;
      if (document.activeElement === document.body || document.activeElement === button)
        button.focus();
      restoreFocus.current = false;
    }
  }, [state.kind]);
  const notice = {
    loading: "Loading acquisition evidence…",
    empty: "No retained touchpoints for this conversion.",
    denied: "You do not have permission to inspect this scope.",
    error: "Acquisition lookup failed. No attribution result is available.",
    partial:
      "The query exceeds the evidence bound. Narrow the scope; partial history is not attributed.",
  };
  return createElement(
    "section",
    {
      "aria-label": "Acquisition inspector",
      style: {
        maxWidth: "70rem",
        margin: "auto",
        padding: "1rem",
        fontFamily: "system-ui",
        overflowWrap: "anywhere",
      },
    },
    createElement("h1", null, "Acquisition evidence"),
    createElement(
      "p",
      null,
      "Compare observed touchpoints. Credits describe attribution rules, not causal uplift.",
    ),
    createElement(
      "button",
      {
        type: "button",
        ref: refreshButton,
        onClick: () => {
          const button = refreshButton.current;
          restoreFocus.current = button?.ownerDocument.activeElement === button;
          onRefresh();
        },
        disabled: state.kind === "loading",
      },
      "Refresh evidence",
    ),
    state.kind !== "ready"
      ? createElement(
          "p",
          { role: state.kind === "error" || state.kind === "denied" ? "alert" : "status" },
          notice[state.kind],
        )
      : createElement(
          "div",
          null,
          createElement("h2", null, `Conversion ${state.comparison.conversion.ref}`),
          createElement(
            "p",
            null,
            `Distinct conversions: ${state.comparison.conversionCount}. Evidence revision: ${state.comparison.revision}.`,
          ),
          createElement(
            "div",
            {
              style: {
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,18rem),1fr))",
                gap: "1rem",
              },
            },
            ...state.comparison.results.map((result) =>
              createElement(
                "article",
                {
                  key: `${result.modelId}:${result.definitionRevision}`,
                  style: { border: "1px solid #bbb", borderRadius: "0.5rem", padding: "1rem" },
                },
                createElement("h3", null, result.modelId),
                createElement(
                  "p",
                  null,
                  `Version ${result.modelVersion} · definition ${result.definitionRevision}`,
                ),
                createElement(
                  "p",
                  null,
                  `${result.status} · ${result.channel} · credit ${result.credit}`,
                ),
                createElement(
                  "p",
                  null,
                  `Selected touchpoint: ${result.touchpointRefs.join(", ") || "none"}`,
                ),
                createElement(
                  "p",
                  null,
                  `Inclusive window: ${result.window.fromInclusive} – ${result.window.toInclusive}`,
                ),
                createElement(
                  "p",
                  null,
                  "Partial retained observation history; first touch is not lifetime first contact.",
                ),
              ),
            ),
          ),
          createElement("h2", null, "Observed sources"),
          createElement(
            "ul",
            null,
            ...state.comparison.touchpoints.map((row) =>
              createElement(
                "li",
                { key: row.id },
                `${row.id} · ${row.occurredAt} · ${row.source} · ${
                  Object.entries(row.context.campaign)
                    .map(([key, value]) => `${key}=${value}`)
                    .join(", ") || `unknown / referrer ${row.context.referrer.status}`
                } · landing ${row.context.landingRef}`,
              ),
            ),
          ),
          createElement("h2", null, `Separate declarations: ${state.comparison.declarationStatus}`),
          createElement(
            "p",
            null,
            "Self-reports and referral claims do not overwrite observed channels or increase the conversion total.",
          ),
          createElement(
            "ul",
            null,
            ...state.comparison.declarations.map((row) =>
              createElement(
                "li",
                { key: row.id },
                `${row.sourceKind} · ${row.claim ?? "masked"} · ${row.occurredAt}`,
              ),
            ),
          ),
        ),
  );
}
