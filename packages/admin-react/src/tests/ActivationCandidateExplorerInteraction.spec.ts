import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ActivationCandidateExplorer } from "../libs/ActivationCandidateExplorer";
import type { ActivationCandidateExplorerProps } from "../libs/ActivationCandidateExplorer";
import type { ActivationExplorerState } from "@croco/admin-core";
const hooks = vi.hoisted(() => ({
  index: 0,
  values: [] as unknown[],
  effects: [] as (() => void)[],
}));
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
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
    if (!previous || dependencies.some((value, offset) => !Object.is(value, previous[offset]))) {
      hooks.values[index] = dependencies;
      hooks.effects.push(effect);
    }
  },
}));
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
  let tree = ActivationCandidateExplorer(props);
  const effects = hooks.effects.splice(0);
  effects.forEach((effect) => effect());
  hooks.index = 0;
  tree = ActivationCandidateExplorer(props);
  return tree;
}
beforeEach(() => {
  hooks.index = 0;
  hooks.values = [];
  hooks.effects = [];
});
describe("ActivationCandidateExplorer authoritative state", () => {
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
