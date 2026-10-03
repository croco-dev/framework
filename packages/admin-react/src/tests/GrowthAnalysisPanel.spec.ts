import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GrowthAnalysisPanel } from "../libs/GrowthAnalysisPanel";
import type * as ReactAPI from "react";
import type { AnalysisProposal } from "@croco/analytics-core";
import type { GrowthAnalysisPanelProps } from "../libs/GrowthAnalysisPanel";

const hooks = vi.hoisted(() => ({ active: false, index: 0, slots: [] as unknown[] }));
vi.mock("react", async (importOriginal) => {
  const react = await importOriginal<typeof ReactAPI>();
  const runEffect = react.useEffect;
  return {
    ...react,
    useState: <T>(initial: T) => {
      if (!hooks.active) return react.useState(initial);
      const index = hooks.index++;
      if (!(index in hooks.slots)) hooks.slots[index] = initial;
      return [
        hooks.slots[index] as T,
        (next: T) => {
          hooks.slots[index] = next;
        },
      ];
    },
    useRef: <T>(initial: T) => {
      if (!hooks.active) return react.useRef(initial);
      const index = hooks.index++;
      if (!(index in hooks.slots)) hooks.slots[index] = { current: initial };
      return hooks.slots[index] as { current: T };
    },
    useId: () => (hooks.active ? "growth-analysis-test" : react.useId()),
    useEffect: (...args: Parameters<typeof react.useEffect>) => {
      if (!hooks.active) runEffect(...args);
    },
  };
});

beforeEach(() => {
  hooks.active = false;
  hooks.index = 0;
  hooks.slots = [];
});

type InteractionNode = {
  type: unknown;
  props: {
    children?: unknown;
    "data-state"?: string;
    role?: string;
    onClick?: () => void;
    onChange?: (event: { currentTarget: { value: string } }) => void;
    onSubmit?: (event: { preventDefault: () => void }) => void;
  };
};
function findNode(tree: unknown, match: (node: InteractionNode) => boolean): InteractionNode {
  function search(value: unknown): InteractionNode | undefined {
    if (Array.isArray(value)) return value.map(search).find(Boolean);
    if (!value || typeof value !== "object" || !("type" in value) || !("props" in value)) return;
    const node = value as InteractionNode;
    return match(node) ? node : search(node.props.children);
  }
  const node = search(tree);
  if (!node) throw new Error("Expected interaction element");
  return node;
}
function interaction(props: GrowthAnalysisPanelProps) {
  hooks.active = true;
  const tree = () => {
    hooks.index = 0;
    return GrowthAnalysisPanel(props) as InteractionNode;
  };
  return {
    submit(question: string) {
      findNode(tree(), (node) => node.type === "textarea").props.onChange?.({
        currentTarget: { value: question },
      });
      findNode(tree(), (node) => node.type === "form").props.onSubmit?.({
        preventDefault: () => {},
      });
    },
    cancel() {
      findNode(
        tree(),
        (node) => node.type === "button" && node.props.children === "Cancel analysis",
      ).props.onClick?.();
    },
    state: () => tree().props["data-state"],
    alert: () => findNode(tree(), (node) => node.props.role === "alert").props.children,
  };
}
function pendingProposal() {
  let resolve!: (proposal: AnalysisProposal) => void;
  let reject!: (cause: Error) => void;
  const promise = new Promise<AnalysisProposal>((fulfill, fail) => {
    resolve = fulfill;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function render() {
  const propose = vi.fn();
  const execute = vi.fn();
  const html = renderToStaticMarkup(createElement(GrowthAnalysisPanel, { propose, execute }));
  return { html, propose, execute };
}

describe("GrowthAnalysisPanel", () => {
  it("starts with a bounded, labeled question and disables empty submission", () => {
    const { html } = render();
    expect(html).toContain('aria-label="Growth analysis"');
    expect(html).toContain('data-state="empty"');
    expect(html).toContain('aria-busy="false"');
    expect(html).toContain('maxLength="2000"');
    expect(html).toMatch(/<label for="([^"]+)">Analysis question<\/label><textarea id="\1"/);
    expect(html).toContain('<button type="submit" disabled="">Propose analysis</button>');
    expect(html).not.toContain("Analysis complete");
    expect(html).not.toContain("Confirm and run");
  });

  it("does not propose or execute during rendering", () => {
    const { propose, execute } = render();
    expect(propose).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });
  it("ignores an old successful proposal after cancellation and a newer proposal completes", async () => {
    const previous = pendingProposal();
    const propose = vi
      .fn<GrowthAnalysisPanelProps["propose"]>()
      .mockReturnValueOnce(previous.promise)
      .mockResolvedValueOnce({
        status: "unavailable",
        reason: "refused",
        usage: { kind: "unknown" },
      });
    const execute = vi.fn();
    const panel = interaction({ propose, execute });
    panel.submit("old question");
    panel.cancel();
    expect(propose.mock.calls[0]?.[1].aborted).toBe(true);
    panel.submit("new question");
    await vi.waitFor(() =>
      expect(panel.alert()).toBe(
        "The model declined this question. Revise the question and retry.",
      ),
    );
    previous.resolve({ status: "unavailable", reason: "unsupported", usage: { kind: "unknown" } });
    await previous.promise;
    expect(panel.alert()).toBe("The model declined this question. Revise the question and retry.");
    expect(execute).not.toHaveBeenCalled();
  });

  it("ignores an old rejection after cancellation and a newer proposal completes", async () => {
    const previous = pendingProposal();
    const propose = vi
      .fn<GrowthAnalysisPanelProps["propose"]>()
      .mockReturnValueOnce(previous.promise)
      .mockResolvedValueOnce({
        status: "unavailable",
        reason: "refused",
        usage: { kind: "unknown" },
      });
    const panel = interaction({ propose, execute: vi.fn() });
    panel.submit("old question");
    panel.cancel();
    panel.submit("new question");
    await vi.waitFor(() =>
      expect(panel.alert()).toBe(
        "The model declined this question. Revise the question and retry.",
      ),
    );
    const settled = previous.promise.catch(() => undefined);
    previous.reject(
      Object.assign(new Error("Old provider failure"), {
        code: "analytics-core/analysis-provider-failed",
      }),
    );
    await settled;
    expect(panel.alert()).toBe("The model declined this question. Revise the question and retry.");
  });

  it("returns unavailable when the proposal contains no choices without executing", async () => {
    const propose = vi.fn<GrowthAnalysisPanelProps["propose"]>().mockResolvedValue({
      status: "confirmation",
      choices: [],
      usage: { kind: "unknown" },
    });
    const execute = vi.fn();
    const panel = interaction({ propose, execute });
    panel.submit("activation");
    await vi.waitFor(() => expect(panel.state()).toBe("unavailable"));
    expect(panel.alert()).toBe("Analysis is unavailable. Submit the question again to retry.");
    expect(execute).not.toHaveBeenCalled();
  });
});
