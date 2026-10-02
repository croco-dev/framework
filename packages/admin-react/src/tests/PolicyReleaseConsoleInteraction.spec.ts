import { beforeEach, describe, expect, it, vi } from "vitest";
import { PolicyReleaseConsole } from "../libs/PolicyReleaseConsole";
import type {
  PolicyReleaseConsoleProps,
  PolicyReleaseConsoleState,
} from "../libs/PolicyReleaseConsole";

const hooks = vi.hoisted(() => ({ draft: undefined as unknown }));
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useState: <T>(initial: T) => {
    hooks.draft ??= initial;
    return [
      hooks.draft as T,
      (next: T | ((current: T) => T)) => {
        hooks.draft =
          typeof next === "function" ? (next as (current: T) => T)(hooks.draft as T) : next;
      },
    ];
  },
}));

type Node = { type: unknown; props: Record<string, unknown> & { children?: unknown } };
function find(value: unknown, type: string, name: string): Node | undefined {
  if (Array.isArray(value)) {
    for (const child of value) {
      const result = find(child, type, name);
      if (result) return result;
    }
    return;
  }
  if (!value || typeof value !== "object" || !("type" in value)) return;
  const node = value as Node;
  if (typeof node.type === "function")
    return find((node.type as (props: unknown) => unknown)(node.props), type, name);
  if (node.type === type && (node.props.name === name || node.props.children === name)) return node;
  return find(node.props.children, type, name);
}
const ready: Extract<PolicyReleaseConsoleState, { kind: "ready" }> = {
  kind: "ready",
  policyId: "display-a",
  revision: 1,
  status: "draft",
  fields: [{ key: "rules", label: "Rules", input: "json", value: { theme: "light" } }],
  diagnostics: [],
  diff: [],
  impact: [],
  canWrite: true,
  canReview: true,
  canPublish: true,
};
let props: PolicyReleaseConsoleProps;
function input(): Node {
  const result = find(PolicyReleaseConsole(props), "textarea", "rules");
  if (!result) throw new Error("Missing JSON input");
  return result;
}
function type(text: string): void {
  const change = input().props.onChange as (event: { currentTarget: { value: string } }) => void;
  change({ currentTarget: { value: text } });
}
function replace(value: unknown): void {
  props = { ...props, state: { ...ready, fields: [{ ...ready.fields[0], value }] } };
}
function button(label: string): Node | undefined {
  return find(PolicyReleaseConsole(props), "button", label);
}

describe("PolicyReleaseConsole JSON draft reconciliation", () => {
  beforeEach(() => {
    hooks.draft = undefined;
    props = {
      state: ready,
      reason: "Synthetic edit",
      effectiveAt: "",
      onEdit: vi.fn(),
      onReasonChange: vi.fn(),
      onEffectiveAtChange: vi.fn(),
      onSave: vi.fn(),
      onReview: vi.fn(),
      onPublish: vi.fn(),
      onReload: vi.fn(),
    };
  });
  it("keeps invalid intermediate text local and blocks commands", () => {
    type("{");
    expect(input().props.value).toBe("{");
    expect(input().props["aria-invalid"]).toBe(true);
    expect(props.onEdit).not.toHaveBeenCalled();
    expect(button("Save draft")?.props.disabled).toBe(true);
    expect(button("Review revision")?.props.disabled).toBe(true);
    props = { ...props, reason: "Changed reason" };
    expect(input().props.value).toBe("{");
  });
  it("preserves raw valid text for the exact emitted value and consumes that acknowledgement", () => {
    const text = '{ "theme" : "edited" }';
    const onEdit = vi.fn((_key: string, value: unknown) => replace(value));
    props = { ...props, onEdit };
    type(text);
    expect(onEdit).toHaveBeenCalledWith("rules", { theme: "edited" });
    expect(input().props.value).toBe(text);
    replace(ready.fields[0].value);
    expect(JSON.parse(String(input().props.value))).toEqual({ theme: "light" });
    type(text);
    expect(input().props.value).toBe(text);
    type("{");
    expect(input().props["aria-invalid"]).toBe(true);
    replace({ theme: "replacement" });
    expect(JSON.parse(String(input().props.value))).toEqual({ theme: "replacement" });
    replace(onEdit.mock.calls[0]?.[1]);
    expect(JSON.parse(String(input().props.value))).toEqual({ theme: "edited" });
    expect(input().props["aria-invalid"]).toBeUndefined();
  });
  it.each([false, true])(
    "replaces the draft and parse error for an external snapshot, invalid=%s",
    (invalid) => {
      type(invalid ? "{" : '{"theme":"local"}');
      replace({ theme: "light" });
      expect(JSON.parse(String(input().props.value))).toEqual({ theme: "light" });
      expect(input().props["aria-invalid"]).toBeUndefined();
      expect(button("Save draft")?.props.disabled).toBe(false);
    },
  );
  it("clears a draft on Reload even when the parent keeps its value", () => {
    type("{");
    const reload = button("Reload policy")?.props.onClick as () => void;
    reload();
    expect(props.onReload).toHaveBeenCalledOnce();
    expect(JSON.parse(String(input().props.value))).toEqual({ theme: "light" });
    expect(input().props["aria-invalid"]).toBeUndefined();
    expect(button("Save draft")?.props.disabled).toBe(false);
  });
  it("discards errors for removed or non-JSON fields", () => {
    type("{");
    props = { ...props, state: { ...ready, fields: [] } };
    expect(button("Save draft")?.props.disabled).toBe(false);
    props = { ...props, state: ready };
    expect(input().props["aria-invalid"]).toBeUndefined();
    type("{");
    props = {
      ...props,
      state: {
        ...ready,
        fields: [{ key: "rules", label: "Rules", input: "text", value: "plain" }],
      },
    };
    expect(button("Save draft")?.props.disabled).toBe(false);
  });
  it("clears visible raw text when a field becomes sensitive", () => {
    type("{");
    props = { ...props, state: { ...ready, fields: [{ ...ready.fields[0], sensitive: true }] } };
    expect(input().props.value).toBe("");
    expect(input().props["aria-invalid"]).toBeUndefined();
  });
  it("scopes the mounted ready editor to policy and revision", () => {
    const first = PolicyReleaseConsole(props);
    expect(PolicyReleaseConsole({ ...props, state: { ...ready } }).key).toBe(first.key);
    expect(
      PolicyReleaseConsole({ ...props, state: { ...ready, policyId: "display-b" } }).key,
    ).not.toBe(first.key);
    expect(PolicyReleaseConsole({ ...props, state: { ...ready, revision: 2 } }).key).not.toBe(
      first.key,
    );
    expect(PolicyReleaseConsole({ ...props, state: { kind: "loading" } }).type).not.toBe(
      first.type,
    );
  });
});
