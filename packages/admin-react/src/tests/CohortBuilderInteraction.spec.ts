import { beforeEach, describe, expect, it, vi } from "vitest";
import { CohortBuilder } from "../libs/CohortBuilder";
import type { CohortBuilderProps } from "../libs/CohortBuilder";
const hooks = vi.hoisted(() => ({ index: 0, values: [] as unknown[] }));
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useEffect: () => {},
  useRef: () => ({ current: null }),
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
}));
type ElementNode = {
  type: unknown;
  props: { children?: unknown; onClick?: () => void; disabled?: boolean };
};
function findButton(value: unknown, label: string): ElementNode | undefined {
  if (Array.isArray(value)) {
    for (const child of value) {
      const found = findButton(child, label);
      if (found) return found;
    }
    return;
  }
  if (!value || typeof value !== "object" || !("type" in value)) return;
  const node = value as ElementNode;
  if (typeof node.type === "function")
    return findButton((node.type as (props: unknown) => unknown)(node.props), label);
  if (node.type === "button" && node.props.children === label) return node;
  return findButton(node.props.children, label);
}
const onPreview = vi.fn(async () => {});
const props: CohortBuilderProps = {
  definition: {
    id: "trial",
    version: 1,
    scope: { appId: "app", environment: "test", tenantId: "tenant" },
    subjectKind: "customer",
    root: {
      kind: "all",
      children: [{ kind: "fact", field: "plan", operator: "eq", value: "trial" }],
    },
  },
  registration: {
    fields: { plan: { type: "string", operators: ["eq"], values: ["trial", "paid"] } },
    events: ["report.created"],
    memberships: ["invited"],
  },
  state: { kind: "ready", history: [] },
  actor: "operator",
  asOf: "2026-09-27T00:00:00Z",
  canPreview: true,
  canPublish: true,
  onPreview,
  onPublish: vi.fn(async () => {}),
};
function button(label: string) {
  hooks.index = 0;
  const result = findButton(CohortBuilder(props), label);
  expect(result, label).toBeDefined();
  return result;
}
describe("CohortBuilder condition actions", () => {
  beforeEach(() => {
    hooks.values = [];
    hooks.index = 0;
    onPreview.mockClear();
  });
  it("adds registered conditions and removes them without an empty group", () => {
    expect(button("Remove condition 1")?.props.disabled).toBe(true);
    button("Add event: report.created")?.props.onClick?.();
    button("Add membership: invited")?.props.onClick?.();
    button("Remove condition 2")?.props.onClick?.();
    button("Preview cohort")?.props.onClick?.();
    expect(onPreview).toHaveBeenCalledWith(
      expect.objectContaining({
        definition: expect.objectContaining({
          version: 2,
          root: {
            kind: "all",
            children: [
              props.definition.root.kind === "all" ? props.definition.root.children[0] : undefined,
              { kind: "static", membershipId: "invited" },
            ],
          },
        }),
      }),
    );
  });
  it("introduces NOT and removes it while preserving its child", async () => {
    button("Apply NOT")?.props.onClick?.();
    button("Preview cohort")?.props.onClick?.();
    expect(onPreview).toHaveBeenLastCalledWith(
      expect.objectContaining({
        definition: expect.objectContaining({
          root: expect.objectContaining({
            children: [
              {
                kind: "not",
                child: { kind: "fact", field: "plan", operator: "eq", value: "trial" },
              },
            ],
          }),
        }),
      }),
    );
    await vi.waitFor(() => {
      hooks.index = 0;
      expect(findButton(CohortBuilder(props), "Preview cohort")).toBeDefined();
    });
    button("Remove NOT")?.props.onClick?.();
    button("Preview cohort")?.props.onClick?.();
    expect(onPreview).toHaveBeenLastCalledWith(
      expect.objectContaining({
        definition: { ...props.definition, version: 3 },
      }),
    );
  });
});

describe("CohortBuilder editor identity", () => {
  it("keeps the editor mounted for unrelated rerenders and definition revisions", () => {
    const first = CohortBuilder(props);
    const next = CohortBuilder({
      ...props,
      actor: "another-operator",
      definition: { ...props.definition, version: 2, scope: { ...props.definition.scope } },
      state: { kind: "loading" },
      onPreview: vi.fn(async () => {}),
    });
    expect(next.type).toBe(first.type);
    expect(next.key).toBe(first.key);
  });
  it.each([
    { ...props.definition, id: "another-cohort" },
    { ...props.definition, subjectKind: "account" },
    { ...props.definition, scope: { ...props.definition.scope, tenantId: "another-tenant" } },
    { ...props.definition, scope: { ...props.definition.scope, appId: "another-app" } },
    { ...props.definition, scope: { ...props.definition.scope, environment: "production" } },
  ])("remounts the editor for a different identity: %j", (definition) => {
    expect(CohortBuilder({ ...props, definition }).key).not.toBe(CohortBuilder(props).key);
  });
});
