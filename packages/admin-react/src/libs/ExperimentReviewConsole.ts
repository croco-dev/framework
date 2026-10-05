import { createElement, Fragment, type ReactElement } from "react";

import type {
  ExperimentReviewAction,
  ExperimentReviewConsoleState,
  ExperimentReviewReadyState,
  ExperimentReviewUnitPage,
} from "@croco/admin-core";

export type ExperimentReviewConsoleProps = {
  readonly state: ExperimentReviewConsoleState;
  readonly unitPage?: ExperimentReviewUnitPage;
  readonly onSelectVariant?: (variantId: string) => void;
  readonly selectedVariantId?: string;
  readonly onPageChange?: (cursor: string | null) => void;
  readonly onAction?: (action: ExperimentReviewAction) => void;
  readonly onRefresh?: () => void;
};

export function ExperimentReviewConsole({
  onAction,
  onPageChange,
  onRefresh,
  onSelectVariant,
  selectedVariantId,
  state,
  unitPage,
}: ExperimentReviewConsoleProps): ReactElement {
  if (state.kind === "loading") {
    return createElement(
      "section",
      { "aria-busy": true, "aria-label": "Experiment review", "data-state": "loading" },
      createElement("h1", null, "Experiment review"),
      createElement("p", null, "Loading the experiment review."),
    );
  }
  if (state.kind === "empty") {
    return createElement(
      "section",
      { "aria-label": "Experiment review", "data-state": "empty" },
      createElement("h1", null, "Experiment review"),
      createElement("p", null, state.message ?? "No experiment review data is available yet."),
      onRefresh ? createElement("button", { onClick: onRefresh, type: "button" }, "Retry") : null,
    );
  }
  if (state.kind === "tenant-required") {
    return createElement(
      "section",
      { "aria-label": "Experiment review", "data-state": "tenant-required", role: "alert" },
      createElement("h1", null, state.problem.title ?? "Tenant required"),
      createElement("p", null, state.problem.detail ?? state.problem.code),
    );
  }
  if (state.kind === "permission-denied") {
    return createElement(
      "section",
      { "aria-label": "Experiment review", "data-state": "permission-denied", role: "alert" },
      createElement("h1", null, state.problem.title ?? "Experiment review permission denied"),
      createElement("p", null, state.problem.detail ?? state.problem.code),
      onRefresh ? createElement("button", { onClick: onRefresh, type: "button" }, "Retry") : null,
    );
  }
  if (state.kind === "problem") {
    return createElement(
      Fragment,
      null,
      createElement(
        "section",
        {
          "aria-label": "Experiment review problem",
          "data-problem-code": state.problem.code,
          "data-state": "problem",
          role: "alert",
        },
        createElement("h1", null, state.problem.title ?? "Experiment review unavailable"),
        createElement("p", null, state.problem.detail ?? state.problem.code),
        onRefresh
          ? createElement("button", { onClick: onRefresh, type: "button" }, "Retry review")
          : null,
      ),
      state.partial
        ? createReadyReview({
            onAction,
            onPageChange,
            onRefresh,
            onSelectVariant,
            selectedVariantId,
            state: { ...state.partial, actions: [] },
            unitPage,
          })
        : null,
    );
  }
  return createReadyReview({
    onAction,
    onPageChange,
    onRefresh,
    onSelectVariant,
    selectedVariantId,
    state,
    unitPage,
  });
}

function createReadyReview({
  onAction,
  onPageChange,
  onRefresh,
  onSelectVariant,
  selectedVariantId,
  state,
  unitPage,
}: Omit<ExperimentReviewConsoleProps, "state"> & {
  readonly state: ExperimentReviewReadyState;
}): ReactElement {
  const { snapshot } = state;
  const page = unitPage ?? snapshot.unitPage;
  const selected = snapshot.variants.find((variant) => variant.variantId === selectedVariantId);
  return createElement(
    "section",
    {
      "aria-label": "Experiment review",
      "data-experiment-id": snapshot.plan.experimentId,
      "data-generated-at": snapshot.generatedAt.toISOString(),
      "data-state": "ready",
    },
    createElement("h1", null, `Experiment review ${snapshot.plan.experimentId}`),
    onRefresh
      ? createElement("button", { onClick: onRefresh, type: "button" }, "Refresh review")
      : null,
    createElement(
      "section",
      { "aria-label": "Analysis plan" },
      createElement("h2", null, "Plan"),
      createElement(
        "p",
        null,
        `revision ${snapshot.plan.revision} · metric ${snapshot.plan.primaryMetricId} · method ${snapshot.plan.method} · window ${snapshot.plan.observedWindow.from} to ${snapshot.plan.observedWindow.to}`,
      ),
      createElement("p", null, snapshot.denominatorNote),
    ),
    createElement(
      "section",
      { "aria-label": "Sample ratio mismatch" },
      createElement("h2", null, "SRM"),
      createElement("p", null, `status ${snapshot.srm.status}`),
      snapshot.srm.chiSquare === undefined
        ? createElement("p", null, snapshot.srm.reason)
        : createElement(
            "p",
            null,
            `chi2 ${snapshot.srm.chiSquare} · df ${snapshot.srm.degreesOfFreedom} · p ${snapshot.srm.pValue} · threshold ${snapshot.srm.threshold}`,
          ),
    ),
    createElement(
      "section",
      { "aria-label": "Quality checks" },
      createElement("h2", null, "Quality"),
      createElement(
        "ul",
        null,
        snapshot.quality.map((check) =>
          createElement(
            "li",
            {
              "data-quality-kind": check.kind,
              "data-quality-result": check.result,
              key: check.kind,
            },
            `${check.kind}: ${check.result} · ${check.evidence}`,
          ),
        ),
      ),
    ),
    createElement(
      "section",
      { "aria-label": "Variant primary estimates" },
      createElement("h2", null, "Variants"),
      createElement(
        "ul",
        null,
        snapshot.variants.map((variant) =>
          createElement(
            "li",
            { "data-variant-id": variant.variantId, key: variant.variantId },
            createElement(
              "button",
              {
                "aria-current": variant.variantId === selected?.variantId ? "true" : undefined,
                onClick: () => onSelectVariant?.(variant.variantId),
                type: "button",
              },
              `${variant.variantId} · n=${variant.n} · estimate ${variant.estimate}`,
            ),
            createElement(
              "span",
              null,
              ` · assigned ${variant.funnel.assigned} · exposed ${variant.funnel.exposed} · actioned ${variant.funnel.actioned} · outcome observed ${variant.funnel.outcomeObserved}`,
            ),
          ),
        ),
      ),
    ),
    createElement(
      "section",
      { "aria-label": "Exposure-conditional estimates" },
      createElement("h2", null, "Conditional"),
      createElement("p", null, "descriptive - not randomized"),
      createElement(
        "ul",
        null,
        snapshot.conditional.map((row) =>
          createElement(
            "li",
            { "data-conditional-variant": row.variantId, key: row.variantId },
            `${row.variantId} · exposed ${row.exposed} · nExposed ${row.nExposed} · estimate ${row.estimate}`,
          ),
        ),
      ),
    ),
    snapshot.slices
      ? createElement(
          "section",
          { "aria-label": "Slices" },
          createElement("h2", null, `Slices by ${snapshot.slices.attribute}`),
          createElement(
            "ul",
            null,
            snapshot.slices.cells.map((cell) =>
              createElement(
                "li",
                { key: `${cell.variantId}::${cell.attributeValue}` },
                `${cell.variantId} · ${cell.attributeValue} · assigned ${cell.assigned} · n=${cell.n} · estimate ${cell.estimate}`,
              ),
            ),
          ),
        )
      : null,
    createElement(
      "section",
      { "aria-label": "Reviewed units" },
      createElement("h2", null, "Units"),
      createElement(
        "ol",
        null,
        page.units.map((unit, index) =>
          createElement(
            "li",
            { key: `${unit.maskedId}:${unit.variantId}:${index}` },
            `${unit.maskedId} · ${unit.variantId} · ${unit.exposed ? "exposed" : "unexposed"}`,
          ),
        ),
      ),
      onPageChange && page.nextCursor !== null
        ? createElement(
            "button",
            { onClick: () => onPageChange(page.nextCursor), type: "button" },
            "Next page",
          )
        : null,
    ),
    createElement("p", null, "No automatic winner: interpret quality signals before acting."),
    createElement(
      "section",
      { "aria-label": "Audited review actions" },
      createElement("h2", null, "Actions"),
      createElement(
        "ul",
        null,
        state.actions.map((action) =>
          createElement(
            "li",
            { key: `${action.kind}:${action.targetId}` },
            createElement(
              "button",
              {
                "data-action": action.kind,
                "data-target-id": action.targetId,
                disabled: !action.allowed || onAction === undefined,
                onClick: () => onAction?.(action),
                title: action.reason,
                type: "button",
              },
              "Generate report",
            ),
          ),
        ),
      ),
    ),
  );
}
