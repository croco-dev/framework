import { createElement, Children, isValidElement } from "react";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect, vi } from "vitest";
import { RetentionWorkbench } from "../libs/RetentionWorkbench";
import type { RetentionWorkbenchSnapshot, RetentionWorkbenchState } from "@croco/admin-core";
const snapshot: RetentionWorkbenchSnapshot = {
  inputToken: "a".repeat(64),
  definition: {
    id: "saved",
    version: "1",
    subjectKind: "user",
    timezone: "UTC",
    actions: ["report.saved"],
    deletedSubjectPolicy: "include",
    historyStart: "2026-01-01T00:00:00Z",
  },
  scope: { appId: "app", environment: "test", tenantId: "tenant" },
  completeThrough: null,
  knownHistoryFrom: null,
  cards: [
    {
      id: "week-1",
      kind: "periodic",
      definitionId: "saved",
      definitionVersion: "1",
      numerator: 40,
      denominator: 100,
      value: null,
      availability: "provisional",
      reason: "incomplete-observation",
      window: { from: "2026-01-08T00:00:00Z", to: "2026-01-15T00:00:00Z" },
      sources: ["reports"],
    },
  ],
};
describe("RetentionWorkbench", () => {
  it.each(["loading", "empty", "provisional", "insufficient", "denied", "error", "ready"] as const)(
    "renders explicit %s state",
    (kind) => {
      const state: RetentionWorkbenchState =
        kind === "loading"
          ? { kind }
          : kind === "denied" || kind === "error"
            ? { kind, code: "test/problem" }
            : { kind, snapshot };
      const html = renderToStaticMarkup(
        createElement(RetentionWorkbench, { state, onReload: vi.fn(), onSelectMetric: vi.fn() }),
      );
      expect(html).toContain(`data-state="${kind}"`);
    },
  );
  it("shows observed counts and provisional values without asserting zero percent", () => {
    const html = renderToStaticMarkup(
      createElement(RetentionWorkbench, {
        state: { kind: "provisional", snapshot },
        onReload: vi.fn(),
        onSelectMetric: vi.fn(),
      }),
    );
    expect(html).toContain("40 / 100");
    expect(html).toContain("Not established");
    expect(html).not.toMatch(/>0%<|· 0%/);
    expect(html).toContain('type="button"');
    expect(html).toContain("Inspect denominator for week-1");
    expect(html).toContain("Complete through: Unknown");
    expect(html).toContain("reports");
  });
  it("shows bounded denominator reasons and keyboard-native paging", () => {
    const html = renderToStaticMarkup(
      createElement(RetentionWorkbench, {
        state: { kind: "ready", snapshot },
        onReload: vi.fn(),
        onSelectMetric: vi.fn(),
        onNextPage: vi.fn(),
        drilldown: {
          selectionId: "week-1",
          inputToken: snapshot.inputToken,
          offset: 0,
          nextOffset: 1,
          total: 2,
          rows: [
            {
              subjectLabel: "Subject 1",
              inDenominator: false,
              inNumerator: false,
              reason: "earlier-activity",
              count: 3,
              activeDays: 1,
            },
          ],
        },
      }),
    );
    expect(html).toContain("earlier-activity");
    expect(html).toContain("Next subjects");
    expect(html).toContain("1 shown of 2");
    expect(html).toContain("Subject inclusion and exclusion");
    expect(html).toContain(
      'role="region" aria-label="Subject inclusion and exclusion scroll area" tabindex="0"',
    );
    expect(html).toContain('style="max-width:100%;overflow-x:auto"');
    expect(html).toContain("Active days");
    expect(html).toContain('style="white-space:nowrap"');
  });
  it("requires reload after stale input and hides stale subject rows", () => {
    const html = renderToStaticMarkup(
      createElement(RetentionWorkbench, {
        state: { kind: "ready", snapshot },
        onSelectMetric: vi.fn(),
        onReload: vi.fn(),
        drilldownState: "stale",
        drilldown: {
          inputToken: "b".repeat(64),
          selectionId: "week-1",
          offset: 0,
          nextOffset: null,
          total: 1,
          rows: [
            {
              subjectLabel: "outdated subject",
              inDenominator: true,
              inNumerator: true,
              reason: "retained",
              count: 1,
              activeDays: 1,
            },
          ],
        },
      }),
    );
    expect(html).toContain("Reload retention");
    expect(html).toContain("Retention input changed");
    expect(html).not.toContain("outdated subject");
  });
  it("offers reload for provider failure without bypassing access denial", () => {
    for (const kind of ["error", "denied"] as const) {
      const html = renderToStaticMarkup(
        createElement(RetentionWorkbench, {
          state: { kind, code: "source/failure" },
          onSelectMetric: vi.fn(),
          onReload: vi.fn(),
        }),
      );
      expect(html.includes("Reload retention")).toBe(kind === "error");
    }
  });

  it("propagates the loaded token for selection and page requests", () => {
    const onSelectMetric = vi.fn();
    const onNextPage = vi.fn();
    const onReload = vi.fn();
    const view = RetentionWorkbench({
      state: { kind: "ready", snapshot },
      onSelectMetric,
      onNextPage,
      onReload,
      drilldown: {
        inputToken: snapshot.inputToken,
        selectionId: "week-1",
        offset: 0,
        nextOffset: 1,
        total: 2,
        rows: [],
      },
    });
    function clickButtons(node: ReactNode) {
      Children.forEach(node, (child) => {
        if (!isValidElement<{ children?: ReactNode; onClick?: () => void }>(child)) return;
        if (child.type === "button") child.props.onClick?.();
        clickButtons(child.props.children);
      });
    }
    clickButtons(view);
    expect(onSelectMetric).toHaveBeenCalledWith("week-1", snapshot.inputToken);
    expect(onNextPage).toHaveBeenCalledWith("week-1", 1, snapshot.inputToken);
    expect(onReload).not.toHaveBeenCalled();
    clickButtons(
      RetentionWorkbench({
        state: { kind: "ready", snapshot },
        onSelectMetric,
        onReload,
        drilldownState: "stale",
      }),
    );
    expect(onReload).toHaveBeenCalledOnce();
  });
});
