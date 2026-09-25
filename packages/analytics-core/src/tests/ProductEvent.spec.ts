import { describe, expect, expectTypeOf, it, vi } from "vitest";

import { AnalyticsManager } from "../libs/AnalyticsManager";
import {
  defineProductEvent,
  InMemoryProductEventDiagnosticsSink,
  ProductEventCatalog,
  ProductEventDefinitionProblem,
  productEventManifestJson,
  productEventManifestMarkdown,
} from "../libs/ProductEvent";
import type { ProductEventPayload } from "../libs/ProductEvent";

class LocalAnalyticsManager extends AnalyticsManager {
  capture = vi.fn();
  identify = vi.fn();
  group = vi.fn();
}

const reportCreated = defineProductEvent({
  name: "report.created",
  description: "A report has been committed for a tenant.",
  version: 1,
  subjectKind: "user",
  occurrence: "committed",
  scope: "tenant",
  owner: "reporting",
  sourceLocation: "src/reports/ReportService.ts:42",
  schema: {
    type: "object",
    properties: {
      reportType: { type: "string", enum: ["daily", "monthly"] },
      itemCount: { type: "number" },
      tags: { type: "array", items: { type: "string" }, optional: true },
    },
  },
  properties: {
    reportType: "Report period",
    itemCount: "Number of items",
    tags: "Classification tags",
  },
});

const context = {
  appId: "reports-app",
  environment: "production",
  tenantId: "tenant-a",
  subject: { kind: "user" as const, id: "user-a" },
  eventId: "event-1",
  occurredAt: "2026-01-02T03:04:05.000Z",
};
const scope = {
  appId: context.appId,
  environment: context.environment,
  tenantId: context.tenantId,
};

describe("ProductEventCatalog", () => {
  it("infers the capture payload from the declared schema", () => {
    type Payload = ProductEventPayload<typeof reportCreated.schema>;
    expectTypeOf<Payload["reportType"]>().toEqualTypeOf<"daily" | "monthly">();
    expectTypeOf<Payload["itemCount"]>().toEqualTypeOf<number>();
    expectTypeOf<Payload["tags"]>().toEqualTypeOf<string[] | undefined>();
  });

  it("rejects invalid types, missing properties, and unregistered versions before transport", () => {
    const manager = new LocalAnalyticsManager();
    const catalog = new ProductEventCatalog([reportCreated], manager);

    expect(
      catalog.captureTyped(
        reportCreated,
        { reportType: "daily", itemCount: "wrong" } as never,
        context,
      ),
    ).toEqual({ status: "invalid", code: "analytics-core/product-event-property-invalid" });
    expect(catalog.captureTyped(reportCreated, { reportType: "daily" } as never, context)).toEqual({
      status: "invalid",
      code: "analytics-core/product-event-property-required",
    });
    expect(
      catalog.validatePayload("report.created", 2, { reportType: "daily", itemCount: 1 }),
    ).toEqual({ status: "invalid", code: "analytics-core/product-event-version-unregistered" });
    expect(manager.capture).not.toHaveBeenCalled();
    expect(catalog.getObservation(scope, "report.created", 1)).toMatchObject({
      kind: "observed",
      receivedCount: 0,
    });
  });

  it("preserves caller event identity across retries and permits distinct real actions", () => {
    const manager = new LocalAnalyticsManager();
    const catalog = new ProductEventCatalog([reportCreated], manager);
    const payload = { reportType: "daily" as const, itemCount: 2 };

    const first = catalog.captureTyped(reportCreated, payload, context);
    const retry = catalog.captureTyped(reportCreated, payload, context);
    const nextAction = catalog.captureTyped(reportCreated, payload, {
      ...context,
      eventId: "event-2",
    });

    expect(first).toMatchObject({ status: "accepted", eventId: "event-1" });
    expect(retry).toMatchObject({ status: "accepted", eventId: "event-1" });
    expect(nextAction).toMatchObject({ status: "accepted", eventId: "event-2" });
    expect(manager.capture.mock.calls.map((call) => call[1]?.eventId)).toEqual([
      "event-1",
      "event-1",
      "event-2",
    ]);
    expect(catalog.getObservation(scope, "report.created", 1)).toMatchObject({
      kind: "observed",
      receivedCount: 3,
    });
  });

  it("rejects forged reserved context fields and mismatched subject scope", () => {
    const manager = new LocalAnalyticsManager();
    const catalog = new ProductEventCatalog([reportCreated], manager);

    expect(
      catalog.captureTyped(
        reportCreated,
        {
          reportType: "daily",
          itemCount: 2,
          tenantId: "attacker",
          userId: "attacker",
          occurredAt: "2000-01-01",
        } as never,
        context,
      ),
    ).toMatchObject({ status: "invalid" });
    expect(
      catalog.captureTyped(
        reportCreated,
        { reportType: "daily", itemCount: 2 },
        {
          ...context,
          tenantId: undefined,
        },
      ),
    ).toEqual({ status: "invalid", code: "analytics-core/product-event-context-invalid" });
    expect(manager.capture).not.toHaveBeenCalled();
  });

  it("makes one definition the source of both validation and deterministic manifests", () => {
    const first = new ProductEventCatalog([reportCreated]);
    const second = new ProductEventCatalog([reportCreated]);
    const json = productEventManifestJson(first);

    expect(json).toBe(productEventManifestJson(second));
    expect(productEventManifestMarkdown(first)).toBe(productEventManifestMarkdown(second));
    expect(JSON.parse(json)[0].schema).toEqual({
      type: "object",
      properties: {
        itemCount: { type: "number" },
        reportType: { type: "string", enum: ["daily", "monthly"] },
        tags: { type: "array", items: { type: "string" } },
      },
      required: ["itemCount", "reportType"],
      additionalProperties: false,
    });
    expect(
      first.validatePayload("report.created", 1, { reportType: "daily", itemCount: 2 }),
    ).toEqual({ status: "valid" });
    expect(
      first.validatePayload("report.created", 1, { reportType: "weekly", itemCount: 2 }),
    ).toMatchObject({ status: "invalid" });
  });

  it("rejects duplicate registration and reserved declaration properties at bootstrap", () => {
    expect(() => new ProductEventCatalog([reportCreated, reportCreated])).toThrow(
      ProductEventDefinitionProblem,
    );
    expect(() =>
      defineProductEvent({
        ...reportCreated,
        schema: { type: "object", properties: { userId: { type: "string" } } },
        properties: { userId: "Forged identity" },
      }),
    ).toThrow(ProductEventDefinitionProblem);
  });

  it("reports unavailable transport without counting a received event", () => {
    const catalog = new ProductEventCatalog([reportCreated]);
    expect(catalog.getObservation(scope, "report.created", 1)).toEqual({ kind: "unobserved" });
    expect(
      catalog.captureTyped(reportCreated, { reportType: "monthly", itemCount: 4 }, context),
    ).toEqual({
      status: "unavailable",
      code: "analytics-core/product-event-transport-unavailable",
    });
    expect(catalog.getObservation(scope, "report.created", 1)).toEqual({
      kind: "observed",
      receivedCount: 0,
      recentFailureCodes: ["analytics-core/product-event-transport-unavailable"],
    });
  });

  it("bounds process-local diagnostic samples without retaining payloads", () => {
    const sink = new InMemoryProductEventDiagnosticsSink(1, 2);
    sink.recordFailure(scope, "report.created", 1, "first");
    sink.recordFailure(scope, "report.created", 1, "second");
    sink.recordFailure(scope, "report.created", 1, "third");
    expect(sink.getObservation(scope, "report.created", 1)).toEqual({
      kind: "observed",
      receivedCount: 0,
      recentFailureCodes: ["second", "third"],
    });
    sink.recordFailure(scope, "other", 1, "last");
    expect(sink.getObservation(scope, "report.created", 1)).toEqual({ kind: "unobserved" });
  });

  it("isolates diagnostics by app, environment, and tenant", () => {
    const catalog = new ProductEventCatalog([reportCreated], new LocalAnalyticsManager());
    const payload = { reportType: "daily" as const, itemCount: 2 };
    const otherScope = { appId: "other-app", environment: "staging", tenantId: "tenant-b" };

    catalog.captureTyped(reportCreated, payload, context);
    catalog.captureTyped(reportCreated, payload, { ...context, ...otherScope, eventId: "event-2" });

    expect(catalog.getObservation(scope, "report.created", 1)).toMatchObject({ receivedCount: 1 });
    expect(catalog.getObservation(otherScope, "report.created", 1)).toMatchObject({
      receivedCount: 1,
    });
    expect(catalog.getObservation({ ...scope, tenantId: "tenant-b" }, "report.created", 1)).toEqual(
      { kind: "unobserved" },
    );
    expect(
      catalog.getObservation({ ...scope, environment: "staging" }, "report.created", 1),
    ).toEqual({ kind: "unobserved" });
  });

  it("keeps app-scoped receipts separate from tenant-scoped contexts", () => {
    const appEvent = defineProductEvent({
      ...reportCreated,
      name: "app.started",
      subjectKind: "anonymous",
      scope: "app",
    });
    const manager = new LocalAnalyticsManager();
    const catalog = new ProductEventCatalog([appEvent], manager);
    const appContext = {
      ...context,
      tenantId: undefined,
      subject: { kind: "anonymous" as const, id: "session-a" },
    };
    const payload = { reportType: "daily" as const, itemCount: 1 };

    expect(catalog.captureTyped(appEvent, payload, appContext)).toMatchObject({
      status: "accepted",
    });
    expect(
      catalog.getObservation(
        { appId: context.appId, environment: context.environment },
        "app.started",
        1,
      ),
    ).toMatchObject({ receivedCount: 1 });
    expect(
      catalog.captureTyped(appEvent, payload, { ...appContext, tenantId: "tenant-a" }),
    ).toEqual({
      status: "invalid",
      code: "analytics-core/product-event-context-invalid",
    });
    expect(manager.capture).toHaveBeenCalledTimes(1);
  });

  it("preserves capture outcomes when the diagnostic sink fails", () => {
    const manager = new LocalAnalyticsManager();
    const failingDiagnostics = {
      recordAccepted() {
        throw new Error("diagnostics down");
      },
      recordFailure() {
        throw new Error("diagnostics down");
      },
      getObservation() {
        return { kind: "unobserved" as const };
      },
    };
    const catalog = new ProductEventCatalog([reportCreated], manager, failingDiagnostics);

    expect(
      catalog.captureTyped(reportCreated, { reportType: "daily", itemCount: 1 }, context),
    ).toMatchObject({ status: "accepted", diagnosticsUnavailable: true });
    expect(manager.capture).toHaveBeenCalledTimes(1);
    expect(catalog.captureTyped(reportCreated, { reportType: "daily" } as never, context)).toEqual({
      status: "invalid",
      code: "analytics-core/product-event-property-required",
      diagnosticsUnavailable: true,
    });
    expect(manager.capture).toHaveBeenCalledTimes(1);
    const unavailable = new ProductEventCatalog([reportCreated], undefined, failingDiagnostics);
    expect(
      unavailable.captureTyped(reportCreated, { reportType: "daily", itemCount: 1 }, context),
    ).toEqual({
      status: "unavailable",
      code: "analytics-core/product-event-transport-unavailable",
      diagnosticsUnavailable: true,
    });
  });

  it("freezes nested enum inputs so registered validation and manifests cannot drift", () => {
    const allowed = ["public"];
    const definition = defineProductEvent({
      ...reportCreated,
      name: "report.tagged",
      schema: {
        type: "object",
        properties: { tags: { type: "array", items: { type: "string", enum: allowed } } },
      },
      properties: { tags: "Report tags" },
    });
    const catalog = new ProductEventCatalog([definition]);
    const before = productEventManifestJson(catalog);

    expect(() => allowed.push("secret")).toThrow();
    expect(productEventManifestJson(catalog)).toBe(before);
    expect(catalog.validatePayload("report.tagged", 1, { tags: ["secret"] })).toMatchObject({
      status: "invalid",
    });
  });

  it("rejects sparse arrays before they can serialize to invalid null entries", () => {
    const catalog = new ProductEventCatalog([reportCreated], new LocalAnalyticsManager());
    const tags: string[] = [];
    tags.length = 2;
    const payload = { reportType: "daily" as const, itemCount: 1, tags };

    expect(catalog.validatePayload("report.created", 1, payload)).toEqual({
      status: "invalid",
      code: "analytics-core/product-event-property-invalid",
    });
    expect(catalog.captureTyped(reportCreated, payload, context)).toMatchObject({
      status: "invalid",
    });
    expect(JSON.parse(JSON.stringify(payload)).tags).toEqual([null, null]);
  });

  it("rejects inherited, hidden, and accessor values that transport would omit or recompute", () => {
    const manager = new LocalAnalyticsManager();
    const catalog = new ProductEventCatalog([reportCreated], manager);
    const inherited = Object.create({ reportType: "daily", itemCount: 1 });
    const hidden = { reportType: "daily" };
    Object.defineProperty(hidden, "itemCount", { value: 1, enumerable: false });
    const accessor = { reportType: "daily" };
    Object.defineProperty(accessor, "itemCount", { get: () => 1, enumerable: true });

    expect(catalog.validatePayload("report.created", 1, inherited)).toMatchObject({
      status: "invalid",
    });
    expect(catalog.validatePayload("report.created", 1, hidden)).toMatchObject({
      status: "invalid",
    });
    expect(catalog.validatePayload("report.created", 1, accessor)).toMatchObject({
      status: "invalid",
    });
    expect(catalog.captureTyped(reportCreated, inherited, context)).toMatchObject({
      status: "invalid",
    });
    expect(manager.capture).not.toHaveBeenCalled();
  });

  it("rejects array accessors and captures a stable payload snapshot", () => {
    const manager = new LocalAnalyticsManager();
    const catalog = new ProductEventCatalog([reportCreated], manager);
    const unstableTags = ["daily"];
    Object.defineProperty(unstableTags, "0", {
      enumerable: true,
      get: () => "daily",
    });

    expect(
      catalog.captureTyped(
        reportCreated,
        { reportType: "daily", itemCount: 1, tags: unstableTags },
        context,
      ),
    ).toMatchObject({ status: "invalid" });
    expect(manager.capture).not.toHaveBeenCalled();

    const tags = ["published"];
    expect(
      catalog.captureTyped(reportCreated, { reportType: "daily", itemCount: 1, tags }, context),
    ).toMatchObject({ status: "accepted" });
    tags.push("changed");
    expect(manager.capture.mock.calls[0]?.[1]?.tags).toEqual(["published"]);
  });
});
