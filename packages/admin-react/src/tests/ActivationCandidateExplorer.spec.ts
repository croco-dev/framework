import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ActivationCandidateExplorer } from "../libs/ActivationCandidateExplorer";
import type { ActivationCandidateExplorerProps } from "../libs/ActivationCandidateExplorer";
import type { ActivationExplorerState } from "@croco/admin-core";
import type { ActivationReport } from "@croco/metrics-core";
const report: ActivationReport = {
  definition: {
    id: "activation",
    version: 1,
    subjectKind: "user",
    cohortPolicy: "new",
    timezone: "UTC",
    unit: "subjects",
    sourceRevisions: { events: "v1" },
    sourceRunRef: "run-1",
    minSupport: 0,
    maxRows: 1000,
    maxCandidates: 10,
    windows: [{ id: "first", fromMs: 0, toMs: 1000 }],
    outcomeWindow: { fromMs: 1000, toMs: 2000 },
    candidates: [
      {
        id: "publish",
        actionId: "publish",
        windowId: "first",
        threshold: 1,
        countMode: "frequency",
      },
    ],
  },
  rowCount: 100,
  candidates: [
    {
      candidate: {
        id: "publish",
        actionId: "publish",
        windowId: "first",
        threshold: 1,
        countMode: "frequency",
      },
      cohort: "new",
      eligibleN: 100,
      DO: 40,
      RE: 30,
      NO: 20,
      support: { value: 0.4, zeroDenominatorReason: null },
      passesMinSupport: true,
      precision: { value: 0.75, zeroDenominatorReason: null },
      coverage: { value: 0.6, zeroDenominatorReason: null },
      noRedo: { value: 0.5, zeroDenominatorReason: null },
      excluded: { cohort: 0, missingOutcome: 2, incompleteObservation: 1, missingCount: 3 },
      achievementCurve: { status: "unsupported", reason: "missingVerifiedAchievementTimes" },
    },
  ],
};
function render(state: ActivationExplorerState, canWrite = true): string {
  return renderToStaticMarkup(
    createElement(ActivationCandidateExplorer, {
      state,
      canWrite,
      load: vi.fn(),
      save: vi.fn(),
      exportSaved: vi.fn(),
    }),
  );
}
describe("ActivationCandidateExplorer", () => {
  it("shows all counts, independently labelled ratios, metadata and exclusions without automatic selection", () => {
    const html = render({ kind: "ready", report });
    for (const value of [
      "75.0%",
      "60.0%",
      "50.0%",
      "40.0%",
      "NOREDO",
      "Precision",
      "Coverage",
      "run-1",
      "UTC",
      "missingOutcome",
      "incompleteObservation",
      "missingCount",
    ])
      expect(html).toContain(value);
    expect(html).toContain("RE / (NO + DO)");
    expect(html).toContain("do not establish causation");
    expect(html).toContain("overflow-x:auto");
    expect(html).not.toContain('checked=""');
    expect(html).toContain('disabled="">Save selected candidate');
  });
  it.each(["loading", "empty", "denied", "error", "partial"] as const)(
    "renders %s explicitly",
    (kind) => {
      const state: ActivationExplorerState =
        kind === "partial"
          ? { kind, report }
          : kind === "denied" || kind === "error"
            ? { kind, code: "source-failed" }
            : { kind };
      const html = render(state);
      expect(html).toContain(
        {
          loading: "Loading activation candidates",
          empty: "No activation candidates",
          denied: "Access denied",
          error: "Could not load",
          partial: "Partial evidence",
        }[kind],
      );
    },
  );
  it("shows zero-denominator reasons and disables writing without permission", () => {
    const first = report.candidates[0]!;
    const html = render(
      {
        kind: "ready",
        report: {
          ...report,
          candidates: [
            {
              ...first,
              support: { value: null, zeroDenominatorReason: "noEligibleSubjects" },
              precision: { value: null, zeroDenominatorReason: "noAchievedSubjects" },
            },
          ],
        },
      },
      false,
    );
    expect(html).toContain("Unavailable: noEligibleSubjects");
    expect(html).toContain("Unavailable: noAchievedSubjects");
    expect(html).toContain("Report write permission is required");
  });
});

describe("ActivationCandidateExplorer authoritative state", () => {
  const hooks = { index: 0, values: [] as unknown[], effects: [] as (() => void)[] };
  let InteractionExplorer: typeof ActivationCandidateExplorer;
  beforeEach(async () => {
    hooks.index = 0;
    hooks.values = [];
    hooks.effects = [];
    vi.resetModules();
    vi.doMock("react", async () => ({
      ...(await vi.importActual<Record<string, unknown>>("react")),
      useState: <T>(initial: T) => {
        const index = hooks.index++;
        if (!(index in hooks.values)) hooks.values[index] = initial;
        return [
          hooks.values[index] as T,
          (value: T) => {
            hooks.values[index] = value;
          },
        ];
      },
      useRef: <T>(initial: T) => {
        const index = hooks.index++;
        if (!(index in hooks.values)) hooks.values[index] = { current: initial };
        return hooks.values[index];
      },
      useEffect: (effect: () => void, dependencies: readonly unknown[]) => {
        const index = hooks.index++;
        const previous = hooks.values[index] as readonly unknown[] | undefined;
        if (
          !previous ||
          dependencies.some((value, offset) => !Object.is(value, previous[offset]))
        ) {
          hooks.values[index] = dependencies;
          hooks.effects.push(effect);
        }
      },
    }));
    InteractionExplorer = (await import("../libs/ActivationCandidateExplorer"))
      .ActivationCandidateExplorer;
  });
  afterEach(() => {
    vi.doUnmock("react");
    vi.resetModules();
  });
  type ElementNode = { type: unknown; props: { children?: unknown; onClick?: () => void } };
  function findReload(value: unknown): (() => void) | undefined {
    if (Array.isArray(value)) {
      for (const child of value) {
        const found = findReload(child);
        if (found) return found;
      }
      return;
    }
    if (!value || typeof value !== "object" || !("props" in value)) return;
    const node = value as ElementNode;
    if (node.type === "button" && node.props.children === "Reload candidates")
      return node.props.onClick;
    return findReload(node.props.children);
  }
  function render(props: ActivationCandidateExplorerProps) {
    hooks.index = 0;
    let tree = InteractionExplorer(props);
    const effects = hooks.effects.splice(0);
    effects.forEach((effect) => effect());
    hooks.index = 0;
    tree = InteractionExplorer(props);
    return tree;
  }
  it.each(["denied", "error", "empty", "loading"] as const)(
    "aborts pending load when parent changes to %s",
    async (kind) => {
      let resolve!: (value: ActivationExplorerState) => void;
      let signal: AbortSignal | undefined;
      const props: ActivationCandidateExplorerProps = {
        state: { kind: "empty" },
        canWrite: false,
        save: vi.fn(),
        exportSaved: vi.fn(),
        load: (current) => {
          signal = current;
          return new Promise((done) => {
            resolve = done;
          });
        },
      };
      const reload = findReload(render(props));
      expect(reload).toBeDefined();
      reload?.();
      render(props);
      expect(signal?.aborted).toBe(false);
      const state: ActivationExplorerState =
        kind === "denied" || kind === "error" ? { kind, code: "changed-authority" } : { kind };
      const changedProps = { ...props, state };
      render(changedProps);
      expect(signal?.aborted).toBe(true);
      resolve({ kind: "error", code: "obsolete-load-result" });
      await Promise.resolve();
      const html = renderToStaticMarkup(render(changedProps));
      expect(html).not.toContain("obsolete-load-result");
      expect(html).toContain(
        {
          denied: "Access denied",
          error: "changed-authority",
          empty: "No activation candidates",
          loading: "Loading activation candidates",
        }[kind],
      );
    },
  );
  it("allows the internal loading transition to finish without a parent change", async () => {
    let resolve!: (value: ActivationExplorerState) => void;
    let signal: AbortSignal | undefined;
    const props: ActivationCandidateExplorerProps = {
      state: { kind: "empty" },
      canWrite: false,
      save: vi.fn(),
      exportSaved: vi.fn(),
      load: (current) => {
        signal = current;
        return new Promise((done) => {
          resolve = done;
        });
      },
    };
    findReload(render(props))?.();
    render(props);
    expect(signal?.aborted).toBe(false);
    resolve({ kind: "error", code: "current-load-result" });
    await Promise.resolve();
    expect(renderToStaticMarkup(render(props))).toContain("current-load-result");
  });
});
