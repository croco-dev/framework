import { createElement, isValidElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { TargetingImpactInspector } from "../libs/TargetingImpactInspector";
import type { TargetingImpactInspectorState } from "../libs/TargetingImpactInspector";
import type { TargetingImpactReport } from "@croco/admin-core";
import type * as ReactAPI from "react";

const report: TargetingImpactReport = {
  version: 1,
  definitionHash: "definition-fixed",
  inputHash: "input-fixed",
  input: {
    scope: { appId: "app", environment: "test", tenantId: "tenant", subjectKind: "user" },
    snapshotRef: "historical-snapshot",
    currency: "KRW",
    unit: "won",
    observationWindow: {
      start: "2026-01-01T00:00:00.000Z",
      end: "2026-02-01T00:00:00.000Z",
      completed: true,
    },
    attributionWindowMs: 86400000,
    definition: {
      revision: "preserve-v1",
      unknownPolicy: "preserve",
      scenarios: ["click-only", "post-send-inclusive"],
      changes: ["filter"],
    },
  },
  result: {
    baselineN: 100,
    keptN: 80,
    excludedN: 20,
    unknownN: 0,
    effectiveKeptN: 80,
    effectiveExcludedN: 20,
    observedCostSaved: {
      status: "available",
      amount: 200,
      observedDispatchN: 20,
      totalDispatchN: 20,
      currency: "KRW",
      unit: "won",
    },
    observedVisits: { preSendN: 1, postClickN: 2, postSendNonClickN: 3, postSendUnknownClickN: 0 },
    scenarioValues: [
      {
        scenario: "click-only",
        status: "available",
        excludedVisitSubjectN: 2,
        excludedFinancialEventN: 1,
        excludedObservedRevenue: 100,
      },
      {
        scenario: "post-send-inclusive",
        status: "available",
        excludedVisitSubjectN: 5,
        excludedFinancialEventN: 2,
        excludedObservedRevenue: 200,
      },
    ],
    sourceCoverage: {
      subjectN: 100,
      historicalTraitsN: 100,
      dispatchN: 100,
      observedCostN: 100,
      touchpointsN: 100,
      outcomesN: 100,
    },
    assumptions: ["Constant unit price assumption"],
    limitations: ["No causal effect established"],
  },
};
function render(state: TargetingImpactInspectorState): string {
  return renderToStaticMarkup(
    createElement(TargetingImpactInspector, { state, onReplay: () => {}, onExport: () => {} }),
  );
}
describe("TargetingImpactInspector", () => {
  it("separates observed costs, temporal visits and scenario assumptions with report provenance", () => {
    const html = render({ kind: "ready", report });
    for (const text of [
      "200 KRW",
      "Visits before send",
      "Post-click visits",
      "without a prior click",
      "Click only",
      "Post-send inclusive",
      "not causal estimates",
      "historical-snapshot",
      "definition-fixed",
      "preserve-v1",
      "100 / 100",
      "Export aggregate report",
    ])
      expect(html).toContain(text);
    expect(html).not.toContain("eligible");
  });
  it.each(["loading", "empty", "denied"] as const)(
    "renders %s without leaking earlier report data",
    (kind) => {
      const html = render({ kind });
      expect(html).toContain(`data-state="${kind}"`);
      expect(html).not.toContain("historical-snapshot");
      expect(html).not.toContain("Export aggregate report");
      if (kind === "loading" || kind === "denied") expect(html).toContain("disabled");
    },
  );
  it("preserves unavailable evidence and explicit recovery", () => {
    const html = render({ kind: "unavailable", missingHistoryN: 100 });
    expect(html).toContain("unavailable for 100");
    expect(html).toContain("Import decision-time history");
    expect(html).not.toContain("Observed dispatch cost");
  });
  it("shows provider diagnostic codes and retry action", () => {
    const html = render({ kind: "error", code: "SOURCE_FAILED" });
    expect(html).toContain("SOURCE_FAILED");
    expect(html).toContain("Compare filters");
  });
  it("marks partial costs and scenarios unavailable without formatting them as zero", () => {
    const partial = {
      ...report,
      result: {
        ...report.result,
        observedCostSaved: {
          ...report.result.observedCostSaved,
          status: "unavailable" as const,
          amount: null,
        },
        scenarioValues: report.result.scenarioValues.map((value) => ({
          ...value,
          status: "unavailable" as const,
        })),
      },
    };
    const html = render({ kind: "partial", report: partial });
    expect(html).toContain("Partial evidence");
    expect(html).toContain("Unavailable");
    expect(html).not.toContain("200 KRW");
  });
});

const hooks = vi.hoisted(() => ({ active: false, index: 0, slots: [] as unknown[] }));
vi.mock("react", async (loadOriginal) => {
  const original = await loadOriginal<typeof ReactAPI>();
  return {
    ...original,
    useId: () => (hooks.active ? "policy-test" : original.useId()),
    useState: <T>(initial: T) => {
      if (!hooks.active) return original.useState(initial);
      const slot = hooks.index++;
      if (!(slot in hooks.slots)) hooks.slots[slot] = initial;
      return [
        hooks.slots[slot] as T,
        (value: T) => {
          hooks.slots[slot] = value;
        },
      ];
    },
  };
});
it("loads a different report policy while preserving intentional edits for the same report", () => {
  type Props = {
    children?: unknown;
    value?: string;
    onChange?: (event: { currentTarget: { value: string } }) => void;
  };
  function select(tree: unknown): Props | undefined {
    if (Array.isArray(tree)) return tree.map(select).find(Boolean);
    if (!isValidElement<Props>(tree)) return undefined;
    return tree.type === "select" ? tree.props : select(tree.props.children);
  }
  function view(state: TargetingImpactInspectorState): Props {
    hooks.index = 0;
    const props = select(TargetingImpactInspector({ state, onReplay: () => {} }));
    if (!props) throw new Error("Missing policy selector");
    return props;
  }
  hooks.active = true;
  hooks.slots = [];
  try {
    expect(view({ kind: "loading" }).value).toBe("preserve");
    const loaded = {
      ...report,
      input: {
        ...report.input,
        definition: { ...report.input.definition, unknownPolicy: "exclude" as const },
      },
    };
    const props = view({ kind: "ready", report: loaded });
    expect(props.value).toBe("exclude");
    props.onChange?.({ currentTarget: { value: "preserve" } });
    expect(view({ kind: "ready", report: loaded }).value).toBe("preserve");
    expect(view({ kind: "ready", report: { ...loaded, inputHash: "different-input" } }).value).toBe(
      "exclude",
    );
  } finally {
    hooks.active = false;
    hooks.slots = [];
  }
});

it("selects exclude when an existing exclude report is the initial state", () => {
  const loaded = {
    ...report,
    input: {
      ...report.input,
      definition: { ...report.input.definition, unknownPolicy: "exclude" as const },
    },
  };
  expect(render({ kind: "ready", report: loaded })).toContain(
    '<option value="exclude" selected="">',
  );
});

it("retains a loaded report policy through a failed comparison and unchanged retry", () => {
  type Props = {
    children?: unknown;
    value?: string;
    onSubmit?: (event: { preventDefault: () => void }) => void;
  };
  function find(tree: unknown, type: string): Props | undefined {
    if (Array.isArray(tree)) return tree.map((child) => find(child, type)).find(Boolean);
    if (!isValidElement<Props>(tree)) return undefined;
    return tree.type === type ? tree.props : find(tree.props.children, type);
  }
  const submitted: string[] = [];
  function view(state: TargetingImpactInspectorState): unknown {
    hooks.index = 0;
    return TargetingImpactInspector({ state, onReplay: (policy) => submitted.push(policy) });
  }
  function submit(tree: unknown): void {
    const form = find(tree, "form");
    if (!form?.onSubmit) throw new Error("Missing comparison form");
    form.onSubmit({ preventDefault: () => {} });
  }
  hooks.active = true;
  hooks.slots = [];
  try {
    view({ kind: "loading" });
    const loaded = {
      ...report,
      input: {
        ...report.input,
        definition: { ...report.input.definition, unknownPolicy: "exclude" as const },
      },
    };
    submit(view({ kind: "ready", report: loaded }));
    expect(find(view({ kind: "loading" }), "select")?.value).toBe("exclude");
    const failed = view({ kind: "error", code: "SOURCE_FAILED" });
    expect(find(failed, "select")?.value).toBe("exclude");
    submit(failed);
    expect(submitted).toEqual(["exclude", "exclude"]);
  } finally {
    hooks.active = false;
    hooks.slots = [];
  }
});
