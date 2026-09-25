import type {
  EventCatalogDescriptor,
  EventCatalogSource,
  EventCatalogSourceRequest,
  EventCatalogSourceValidationRequest,
  EventCatalogSourceValidationResult,
} from "@croco/admin-core";
import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { EventCatalogPanel, type EventCatalogPanelProps } from "../libs/EventCatalogPanel";

const hooks = vi.hoisted(() => ({ index: 0, values: [] as unknown[] }));

vi.mock("react", async (importOriginal) => {
  const react = await importOriginal<Record<string, unknown>>();
  return {
    ...react,
    useEffect: (effect: () => void, dependencies: readonly unknown[]): void => {
      const index = hooks.index++;
      const prior = hooks.values[index] as readonly unknown[] | undefined;
      if (!prior || dependencies.some((value, position) => !Object.is(value, prior[position]))) {
        hooks.values[index] = dependencies;
        effect();
      }
    },
    useRef: <T>(value: T): { current: T } => {
      const index = hooks.index++;
      if (!(index in hooks.values)) hooks.values[index] = { current: value };
      return hooks.values[index] as { current: T };
    },
    useId: (): string => {
      const index = hooks.index++;
      return `catalog-payload-${index}`;
    },
    useState: <T>(value: T): readonly [T, (next: T) => void] => {
      const index = hooks.index++;
      if (!(index in hooks.values)) hooks.values[index] = value;
      return [
        hooks.values[index] as T,
        (next: T) => {
          hooks.values[index] = next;
        },
      ];
    },
  };
});

const descriptor: EventCatalogDescriptor = {
  name: "report.created",
  description: "A report exists after a successful domain commit.",
  version: 1,
  scope: "tenant",
  subjectKind: "tenant",
  occurrence: "committed",
  owner: "Reports",
  sourceLocation: "reports/events.ts:10",
  propertyDescriptions: { reportId: "Stable report identifier" },
  schema: { type: "object", required: ["reportId"], properties: { reportId: { type: "string" } } },
};
const secondDescriptor: EventCatalogDescriptor = {
  ...descriptor,
  name: "report.failed",
  version: 2,
};

function createSource(
  options: {
    empty?: boolean;
    partial?: boolean;
    receivedWithoutTimestamp?: boolean;
    unsupported?: boolean;
    fail?: boolean;
    catalogSize?: number;
  } = {},
): EventCatalogSource & { load: ReturnType<typeof vi.fn>; validate: ReturnType<typeof vi.fn> } {
  const descriptors =
    options.catalogSize === undefined
      ? [descriptor, secondDescriptor]
      : Array.from({ length: options.catalogSize }, (_, index) => ({
          ...descriptor,
          name: `report.${String(index).padStart(2, "0")}`,
        }));
  const load = vi.fn(async ({ scope }: EventCatalogSourceRequest) => {
    if (options.fail) throw new Error("Catalog source failed");
    if (options.unsupported) return { kind: "unsupported" as const, scope };
    const entries = (options.empty ? [] : descriptors).map((entry) => ({
      descriptor: scope.kind === "app" ? { ...entry, scope: "app" as const } : entry,
      observation:
        entry.name === "report.created"
          ? {
              kind: "observed" as const,
              receivedCount: options.receivedWithoutTimestamp ? 3 : 0,
              recentFailureCodes: ["analytics-core/invalid-event-payload"],
            }
          : { kind: "unobserved" as const },
    }));
    if (options.partial) {
      return {
        kind: "partial" as const,
        scope,
        entries,
        problem: { code: "admin-core/catalog-partial", status: 206, title: "Catalog incomplete" },
      };
    }
    return { kind: "ready" as const, scope, entries };
  });
  const validate = vi.fn(
    async ({ scope, name, version, payload }: EventCatalogSourceValidationRequest) => {
      if (!descriptors.some((entry) => entry.name === name && entry.version === version)) {
        return { kind: "not-found" as const, scope };
      }
      return typeof payload === "object" &&
        payload !== null &&
        "reportId" in payload &&
        typeof payload.reportId === "string"
        ? { kind: "valid" as const, scope }
        : { kind: "invalid" as const, scope, code: "analytics-core/invalid-event-payload" };
    },
  );
  return { load, validate };
}

function props(
  source: EventCatalogSource,
  grantedPermissions: readonly string[] = ["analytics:read", "analytics:validate"],
): EventCatalogPanelProps {
  return {
    kind: "tenant",
    tenantId: "tenant-1",
    appId: "app-1",
    environment: "test",
    principalId: "operator-1",
    grantedPermissions,
    source,
  };
}

function render(panelProps: EventCatalogPanelProps): { markup: string; tree: ReactElement } {
  hooks.index = 0;
  const tree = EventCatalogPanel(panelProps);
  return { tree, markup: renderToStaticMarkup(tree) };
}

function find(
  node: ReactNode,
  type: string,
  label?: string,
): ReactElement<Record<string, unknown>> {
  if (isValidElement(node)) {
    const element = node as ReactElement<{
      readonly children?: ReactNode;
      readonly ["aria-label"]?: string;
    }>;
    if (
      element.type === type &&
      (label === undefined ||
        element.props["aria-label"] === label ||
        Children.toArray(element.props.children).join("") === label)
    ) {
      return element as ReactElement<Record<string, unknown>>;
    }
    for (const child of Children.toArray(element.props.children)) {
      try {
        return find(child, type, label);
      } catch {
        /* Continue through siblings. */
      }
    }
  }
  throw new Error(`Missing ${type} ${label ?? ""}`);
}

beforeEach(() => {
  hooks.index = 0;
  hooks.values.length = 0;
});

describe("EventCatalogPanel", () => {
  it("loads scoped catalog data and separates observed zero from unobserved entries", async () => {
    const source = createSource();
    const input = props(source);
    expect(render(input).markup).toContain('data-state="loading"');
    await vi.waitFor(() => expect(render(input).markup).toContain('data-state="ready"'));
    const ready = render(input).markup;
    expect(source.load).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: { kind: "tenant", tenantId: "tenant-1", appId: "app-1", environment: "test" },
        principalId: "operator-1",
      }),
    );
    expect(ready).toContain('data-state="ready"');
    expect(ready).toContain("Received: 0");
    expect(ready).toContain("Last received: Never");
    expect(ready).toContain("analytics-core/invalid-event-payload");
    expect(ready).toContain("reports/events.ts:10");
    expect(ready).toContain("Stable report identifier");
    expect(ready).toContain("Event JSON schema");
    expect(ready).toContain("committed");
    expect(ready).toContain("A report exists after a successful domain commit.");
    expect(ready).toContain("This test validates the payload without sending an event.");
    const button = find(render(input).tree, "button", "report.failed (2)");
    (button.props.onClick as () => void)();
    expect(render(input).markup).toContain('data-observation="unobserved"');
  });

  it("shows an unknown timestamp when positive receipts lack a last-received time", async () => {
    const source = createSource({ receivedWithoutTimestamp: true });
    const input = props(source);
    render(input);
    await vi.waitFor(() => expect(render(input).markup).toContain('data-state="ready"'));
    const markup = render(input).markup;
    expect(markup).toContain("Received: 3");
    expect(markup).toContain("Last received: Unknown");
    expect(markup).not.toContain("Last received: Never");
  });

  it("loads and validates an app-scoped catalog without a tenant ID", async () => {
    const source = createSource();
    const input: EventCatalogPanelProps = {
      kind: "app",
      appId: "app-1",
      environment: "test",
      principalId: "operator-1",
      grantedPermissions: ["analytics:app:read", "analytics:app:validate"],
      source,
    };
    render(input);
    await vi.waitFor(() => expect(render(input).markup).toContain('data-state="ready"'));
    expect(source.load).toHaveBeenCalledWith(
      expect.objectContaining({ scope: { kind: "app", appId: "app-1", environment: "test" } }),
    );
    (
      find(render(input).tree, "form", "Test event payload").props.onSubmit as (event: {
        preventDefault: () => void;
      }) => void
    )({ preventDefault: () => {} });
    await vi.waitFor(() => expect(source.validate).toHaveBeenCalled());
    expect(source.validate).toHaveBeenCalledWith(
      expect.objectContaining({ scope: { kind: "app", appId: "app-1", environment: "test" } }),
    );
  });

  it.each([
    ["empty", createSource({ empty: true }), ["analytics:read"]],
    ["unsupported", createSource({ unsupported: true }), ["analytics:read"]],
    ["problem", createSource({ fail: true }), ["analytics:read"]],
    ["permission-denied", createSource(), []],
  ] as const)("renders %s without a test form", async (kind, source, permissions) => {
    const input = props(source, permissions);
    render(input);
    await vi.waitFor(() => expect(render(input).markup).toContain(`data-state="${kind}"`));
    const markup = render(input).markup;
    expect(markup).toContain(`data-state="${kind}"`);
    expect(markup).not.toContain("Test event payload");
  });

  it("warns about partial data while keeping available entries inspectable", async () => {
    const source = createSource({ partial: true });
    const input = props(source);
    render(input);
    await vi.waitFor(() => expect(render(input).markup).toContain('data-state="partial"'));
    const markup = render(input).markup;
    expect(markup).toContain("The event catalog is incomplete (admin-core/catalog-partial)");
    expect(markup).toContain('role="alert"');
    expect(markup).toContain("report.created (1)");
    expect(markup).toContain("Received: 0");
    expect(markup).toContain("Test event payload");
  });

  it("keeps an empty partial state distinct from an empty catalog", async () => {
    const source = createSource({ partial: true, empty: true });
    const input = props(source);
    render(input);
    await vi.waitFor(() => expect(render(input).markup).toContain('data-state="partial"'));
    const markup = render(input).markup;
    expect(markup).toContain("The event catalog is incomplete");
    expect(markup).not.toContain("No product events are defined");
    expect(markup).not.toContain("Test event payload");
  });

  it("hides the previous tenant's catalog while loading the next scope", async () => {
    const source = createSource();
    const first = props(source);
    render(first);
    await vi.waitFor(() => expect(render(first).markup).toContain('data-state="ready"'));

    const second = { ...first, tenantId: "tenant-2" };
    const pending = render(second).markup;
    expect(pending).toContain('data-state="loading"');
    expect(pending).not.toContain("report.created");
    await vi.waitFor(() => expect(render(second).markup).toContain('data-state="ready"'));
    expect(source.load).toHaveBeenLastCalledWith(
      expect.objectContaining({
        scope: { kind: "tenant", tenantId: "tenant-2", appId: "app-1", environment: "test" },
      }),
    );
  });

  it("keeps a stable source loaded and resets the panel when the source changes", async () => {
    const firstSource = createSource();
    const first = props(firstSource);
    render(first);
    await vi.waitFor(() => expect(render(first).markup).toContain('data-state="ready"'));
    (find(render(first).tree, "button", "report.failed (2)").props.onClick as () => void)();
    expect(render(first).markup).toContain('aria-label="report.failed event details"');

    render({ ...first });
    expect(firstSource.load).toHaveBeenCalledTimes(1);

    const secondSource = createSource({ empty: true });
    const second = { ...first, source: secondSource };
    const loading = render(second).markup;
    expect(loading).toContain('data-state="loading"');
    expect(loading).not.toContain("report.failed");
    await vi.waitFor(() => expect(render(second).markup).toContain('data-state="empty"'));
    expect(secondSource.load).toHaveBeenCalledTimes(1);
    expect(firstSource.load).toHaveBeenCalledTimes(1);
  });

  it("limits a large catalog to 20 choices per page and retains selection across pages", async () => {
    const source = createSource({ catalogSize: 25 });
    const first = props(source);
    render(first);
    await vi.waitFor(() => expect(render(first).markup).toContain('data-state="ready"'));

    const initial = render(first).tree;
    const firstPage = renderToStaticMarkup(find(initial, "nav", "Catalog events"));
    expect(firstPage.match(/<li>/g)).toHaveLength(20);
    expect(firstPage).toContain("Page 1 of 2");
    expect(firstPage).not.toContain("report.24");
    (find(initial, "button", "report.00 (1)").props.onClick as () => void)();

    (find(render(first).tree, "button", "Next page").props.onClick as () => void)();
    const secondPage = render(first);
    expect(
      renderToStaticMarkup(find(secondPage.tree, "nav", "Catalog events")).match(/<li>/g),
    ).toHaveLength(5);
    expect(secondPage.markup).toContain("Page 2 of 2");
    expect(secondPage.markup).toContain('aria-label="report.00 event details"');
    expect(secondPage.markup).toContain("report.24 (1)");

    const samePermissions = { ...first, grantedPermissions: [...first.grantedPermissions] };
    expect(render(samePermissions).markup).toContain("Page 2 of 2");
    expect(source.load).toHaveBeenCalledTimes(1);

    const nextScope = { ...first, tenantId: "tenant-2" };
    render(nextScope);
    await vi.waitFor(() => expect(render(nextScope).markup).toContain('data-state="ready"'));
    expect(render(nextScope).markup).toContain("Page 1 of 2");
  });

  it("validates JSON with the same catalog service and keeps test data out of capture", async () => {
    const source = createSource();
    const input = props(source);
    render(input);
    await vi.waitFor(() => expect(render(input).markup).toContain('data-state="ready"'));
    const textarea = find(render(input).tree, "textarea");
    (textarea.props.onChange as (event: { currentTarget: { value: string } }) => void)({
      currentTarget: { value: '{"reportId":"report-1"}' },
    });
    const form = find(render(input).tree, "form", "Test event payload");
    (form.props.onSubmit as (event: { preventDefault: () => void }) => void)({
      preventDefault: () => {},
    });
    await vi.waitFor(() =>
      expect(render(input).markup).toContain("Payload is valid. No event was sent."),
    );
    expect(render(input).markup).toContain("Payload is valid. No event was sent.");
    expect(source.load).toHaveBeenCalledTimes(1);
    expect(source.validate).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "report.created",
        version: 1,
        payload: { reportId: "report-1" },
        scope: { kind: "tenant", tenantId: "tenant-1", appId: "app-1", environment: "test" },
      }),
    );

    const changed = find(render(input).tree, "textarea");
    (changed.props.onChange as (event: { currentTarget: { value: string } }) => void)({
      currentTarget: { value: '{"reportId":42}' },
    });
    const invalidForm = find(render(input).tree, "form", "Test event payload");
    (invalidForm.props.onSubmit as (event: { preventDefault: () => void }) => void)({
      preventDefault: () => {},
    });
    await vi.waitFor(() =>
      expect(render(input).markup).toContain(
        "Payload is invalid (analytics-core/invalid-event-payload). No event was sent.",
      ),
    );
    expect(render(input).markup).toContain(
      "Payload is invalid (analytics-core/invalid-event-payload). No event was sent.",
    );
  });

  it("rejects invalid JSON locally and exposes a separate validation permission failure", async () => {
    const source = createSource();
    const input = props(source, ["analytics:read"]);
    render(input);
    await vi.waitFor(() => expect(render(input).markup).toContain('data-state="ready"'));
    const textarea = find(render(input).tree, "textarea");
    (textarea.props.onChange as (event: { currentTarget: { value: string } }) => void)({
      currentTarget: { value: "{" },
    });
    const form = find(render(input).tree, "form", "Test event payload");
    (form.props.onSubmit as (event: { preventDefault: () => void }) => void)({
      preventDefault: () => {},
    });
    expect(render(input).markup).toContain("Enter a valid JSON payload.");
    expect(source.load).toHaveBeenCalledTimes(1);
    expect(source.validate).not.toHaveBeenCalled();
    const repaired = find(render(input).tree, "textarea");
    (repaired.props.onChange as (event: { currentTarget: { value: string } }) => void)({
      currentTarget: { value: "{}" },
    });
    const validForm = find(render(input).tree, "form", "Test event payload");
    (validForm.props.onSubmit as (event: { preventDefault: () => void }) => void)({
      preventDefault: () => {},
    });
    await vi.waitFor(() =>
      expect(render(input).markup).toContain(
        "You do not have permission to validate event payloads.",
      ),
    );
    expect(render(input).markup).toContain(
      "You do not have permission to validate event payloads.",
    );
    expect(source.load).toHaveBeenCalledTimes(1);
    expect(source.validate).not.toHaveBeenCalled();
  });

  it("ignores an async validation result after the payload changes", async () => {
    const source = createSource();
    let resolveValidation!: (result: EventCatalogSourceValidationResult) => void;
    source.validate.mockImplementationOnce(
      () =>
        new Promise<EventCatalogSourceValidationResult>((resolve) => {
          resolveValidation = resolve;
        }),
    );
    const input = props(source);
    render(input);
    await vi.waitFor(() => expect(render(input).markup).toContain('data-state="ready"'));

    (
      find(render(input).tree, "form", "Test event payload").props.onSubmit as (event: {
        preventDefault: () => void;
      }) => void
    )({ preventDefault: () => {} });
    expect(render(input).markup).toContain("Validating payload");

    (
      find(render(input).tree, "textarea").props.onChange as (event: {
        currentTarget: { value: string };
      }) => void
    )({ currentTarget: { value: "{" } });
    resolveValidation({
      kind: "valid",
      scope: { kind: "tenant", tenantId: "tenant-1", appId: "app-1", environment: "test" },
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(render(input).markup).not.toContain("Payload is valid");

    (
      find(render(input).tree, "form", "Test event payload").props.onSubmit as (event: {
        preventDefault: () => void;
      }) => void
    )({ preventDefault: () => {} });
    expect(render(input).markup).toContain("Enter a valid JSON payload.");
    await Promise.resolve();
    expect(render(input).markup).toContain("Enter a valid JSON payload.");
  });
});
