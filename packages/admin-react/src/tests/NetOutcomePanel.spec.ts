import { Children, createElement, isValidElement } from "react";
import type { ReactNode, ReactElement, FormEvent } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NetOutcomePanel } from "../libs/NetOutcomePanel";
import type { NetOutcomeState, NetOutcomeSnapshot, NetOutcomeDrilldown } from "@croco/admin-core";

const hooks = vi.hoisted(() => ({ index: 0, values: [] as unknown[] }));
vi.mock("react", async (importOriginal) => {
  const react = await importOriginal<Record<string, unknown>>();
  return {
    ...react,
    useEffect: (effect: () => void, dependencies: readonly unknown[]) => {
      const index = hooks.index++;
      const previous = hooks.values[index] as readonly unknown[] | undefined;
      if (
        !previous ||
        dependencies.some((value, position) => !Object.is(value, previous[position]))
      ) {
        hooks.values[index] = dependencies;
        effect();
      }
    },
    useRef: <T>(value: T): { current: T } => {
      const index = hooks.index++;
      if (!(index in hooks.values)) hooks.values[index] = { current: value };
      return hooks.values[index] as { current: T };
    },
    useState: <T>(value: T): readonly [T, (next: T) => void] => {
      const index = hooks.index++;
      if (!(index in hooks.values)) hooks.values[index] = value;
      return [
        hooks.values[index] as T,
        (next) => {
          hooks.values[index] = next;
        },
      ];
    },
  };
});
function findForm(node: ReactNode): ReactElement<{ onSubmit(event: FormEvent): void }> | undefined {
  if (!isValidElement<{ children?: ReactNode }>(node)) return undefined;
  if (node.type === "form") return node as ReactElement<{ onSubmit(event: FormEvent): void }>;
  return Children.toArray(node.props.children).map(findForm).find(Boolean);
}
function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

const request = {
  cutoff: { effectiveAt: "2026-09-30T00:00:00Z", knownAt: "2026-10-01T00:00:00Z" },
  revision: "1",
};
const snapshot: NetOutcomeSnapshot = {
  assignmentSnapshot: { id: "snapshot", unit: "person", arms: ["treatment"] },
  cutoff: request.cutoff,
  revision: "1",
  metricDefinitionVersion: "assigned-net-v1",
  definitionHash: "definition",
  inputHash: "input",
  sources: ["ledger"],
  costCompleteness: [
    {
      arm: "treatment",
      source: "ledger",
      kind: "direct_contact_cost",
      currency: "USD",
      status: "pending",
      pendingCount: 2,
    },
  ],
  byCurrency: [
    {
      currency: "USD",
      arms: [
        {
          arm: "treatment",
          assignedUnits: 100,
          components: {
            payment: "110000",
            refund: "15000",
            cashback: "20000",
            direct_contact_cost: "1000",
            noncash_grant: "500",
          },
          netMinor: "74000",
          complete: false,
          perUnit: null,
          refundRate: { numerator: "1", denominator: "100" },
          refundRateDenominator: "paying_assigned_subjects",
          retentionRate: { numerator: "4", denominator: "5" },
          retentionRateDenominator: "assigned_units",
        },
      ],
      delta: [{ arm: "treatment", baselineArm: "control", value: null }],
    },
  ],
  diagnostics: [{ code: "incomplete_cost" }],
  counts: {
    received: 0,
    duplicates: 0,
    excludedByCutoff: 0,
    superseded: 0,
    accepted: 0,
    rejected: 0,
  },
  quality: "partial",
};

describe("NetOutcomePanel", () => {
  beforeEach(() => {
    hooks.index = 0;
    hooks.values = [];
  });
  it.each(["resolve", "reject"] as const)(
    "ignores an older refresh %s while the latest request is pending",
    async (settlement) => {
      const first = deferred();
      const second = deferred();
      const onRefresh = vi
        .fn()
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(second.promise);
      const state: NetOutcomeState = { kind: "empty" };
      const render = () => {
        hooks.index = 0;
        return NetOutcomePanel({ state, request, onRefresh });
      };
      const submit = () => {
        const form = findForm(render());
        if (!form) throw new Error("Missing refresh form");
        form.props.onSubmit({ preventDefault() {} } as FormEvent);
      };
      submit();
      submit();
      if (settlement === "resolve") first.resolve();
      else first.reject(new Error("Old request failed"));
      await first.promise.catch(() => {});
      await Promise.resolve();
      let html = renderToStaticMarkup(render());
      expect(html).toContain('aria-busy="true"');
      expect(html).not.toContain("Operation failed.");
      second.reject(new Error("Current request failed"));
      await second.promise.catch(() => {});
      await Promise.resolve();
      html = renderToStaticMarkup(render());
      expect(html).toContain('aria-busy="false"');
      expect(html).toContain("Operation failed.");
    },
  );

  it.each(["resolve", "reject"] as const)(
    "ignores a replaced report's drilldown %s",
    async (settlement) => {
      const detail = deferred<NetOutcomeDrilldown>();
      const onDrilldown = vi.fn(() => detail.promise);
      let state: NetOutcomeState = { kind: "partial", snapshot };
      let currentRequest = request;
      const render = () => {
        hooks.index = 0;
        return NetOutcomePanel({ state, request: currentRequest, onRefresh: vi.fn(), onDrilldown });
      };
      const findInspect = (node: ReactNode): ReactElement<{ onClick(): void }> | undefined => {
        if (!isValidElement<{ children?: ReactNode }>(node)) return undefined;
        if (
          node.type === "button" &&
          Children.toArray(node.props.children).join("").startsWith("Inspect ")
        ) {
          return node as ReactElement<{ onClick(): void }>;
        }
        return Children.toArray(node.props.children).map(findInspect).find(Boolean);
      };
      const button = findInspect(render());
      if (!button) throw new Error("Missing inspect button");
      button.props.onClick();
      expect(renderToStaticMarkup(render())).toContain('aria-busy="true"');
      state = { kind: "empty" };
      currentRequest = { ...request, revision: "2" };
      render();
      expect(renderToStaticMarkup(render())).toContain('aria-busy="false"');
      if (settlement === "reject") detail.reject(new Error("Old drilldown failed"));
      else detail.resolve({ rows: [], assumptions: ["old details"], truncated: false });
      await detail.promise.catch(() => {});
      await Promise.resolve();
      const html = renderToStaticMarkup(render());
      expect(html).not.toContain("Operation failed.");
      expect(html).not.toContain("old details");
      expect(html).toContain('aria-busy="false"');
    },
  );

  it("keeps the current refresh error visible through the parent's loading transition", async () => {
    const refresh = deferred();
    let state: NetOutcomeState = { kind: "empty" };
    const onRefresh = vi.fn(() => refresh.promise);
    const render = () => {
      hooks.index = 0;
      return NetOutcomePanel({ state, request, onRefresh });
    };
    const form = findForm(render());
    if (!form) throw new Error("Missing refresh form");
    form.props.onSubmit({ preventDefault() {} } as FormEvent);
    state = { kind: "loading" };
    render();
    refresh.reject(new Error("Current refresh failed"));
    await refresh.promise.catch(() => {});
    await Promise.resolve();
    expect(renderToStaticMarkup(render())).toContain("Operation failed.");
  });

  it.each(["loading", "empty", "denied", "error"] as const)(
    "renders %s with native cutoff refresh controls",
    (kind) => {
      const state: NetOutcomeState =
        kind === "denied" || kind === "error" ? { kind, code: "test/problem" } : { kind };
      const html = renderToStaticMarkup(
        createElement(NetOutcomePanel, { state, request, onRefresh: vi.fn() }),
      );
      expect(html).toContain(`data-state="${kind}"`);
      expect(html).toContain("Effective cutoff");
      expect(html).toContain("Known cutoff");
      expect(html).toContain('type="submit"');
      expect(html).toContain("does not establish causal uplift");
    },
  );
  it("renders authoritative rational totals, separate noncash and partial evidence", () => {
    const html = renderToStaticMarkup(
      createElement(NetOutcomePanel, {
        state: { kind: "partial", snapshot },
        request,
        onRefresh: vi.fn(),
        onDrilldown: vi.fn(),
      }),
    );
    expect(html).toContain("Assigned denominator: 100");
    expect(html).toContain("Net: 74000");
    expect(html).toContain("Noncash face value (separate): 500");
    expect(html).toContain("Retention rate: 4 / 5");
    expect(html).toContain("pending (2 pending)");
    expect(html).toContain("Unavailable (see completeness and diagnostics)");
    expect(html).toContain("Inspect treatment / USD / ledger");
  });
});
