import { describe, expect, it, vi } from "vitest";

import {
  defineProductEvent,
  ProductEventCatalog,
} from "../../../analytics-core/src/libs/ProductEvent";

import type { AnalyticsManager } from "../../../analytics-core/src/libs/AnalyticsManager";

import {
  createInProcessEventCatalogSource,
  loadEventCatalog,
  validateEventCatalogPayload,
  EventCatalogValidationProblem,
  type EventCatalogDescriptor,
  type EventCatalogRegistry,
  type EventCatalogSource,
  type EventCatalogSourceLoadResult,
  type EventCatalogSourceValidationResult,
} from "../index";

const scope = {
  kind: "tenant",
  tenantId: "tenant-1",
  appId: "app-1",
  environment: "staging",
} as const;
const appScope = { kind: "app", appId: "app-1", environment: "staging" } as const;
const descriptor: EventCatalogDescriptor = {
  name: "report.created",
  description: "A report was created after its transaction committed.",
  version: 1,
  subjectKind: "tenant",
  occurrence: "committed",
  scope: "tenant",
  schema: { type: "object", required: ["reportId"] },
  propertyDescriptions: { reportId: "Created report ID" },
  sourceLocation: "src/reports/ReportService.ts:24",
  owner: "reports",
};

function createRegistry(observed: boolean): EventCatalogRegistry {
  return {
    listDescriptors: () => [descriptor],
    getDescriptor: (name, version) =>
      name === descriptor.name && version === descriptor.version ? descriptor : undefined,
    validatePayload: (_name, _version, payload) =>
      typeof payload === "object" && payload !== null && "reportId" in payload
        ? { status: "valid" }
        : { status: "invalid", code: "analytics-core/event-payload-invalid" },
    getObservation: () =>
      observed
        ? { kind: "observed", receivedCount: 0, recentFailureCodes: [] }
        : { kind: "unobserved" },
  };
}

function createSource(catalog: EventCatalogRegistry): EventCatalogSource {
  const source = createInProcessEventCatalogSource(catalog);
  return {
    load: vi.fn(source.load),
    validate: vi.fn(source.validate),
  };
}

const access = {
  ...scope,
  principalId: "operator-1",
  grantedPermissions: ["analytics:read", "analytics:validate"],
};

describe("EventCatalog", () => {
  it("reads an app-scoped receipt without a tenant and filters tenant descriptors", async () => {
    const appDefinition = defineProductEvent({
      name: "app.opened",
      description: "The application was opened.",
      version: 1,
      subjectKind: "anonymous",
      occurrence: "client-observed",
      scope: "app",
      owner: "growth",
      sourceLocation: "src/app/AppEvents.ts:1",
      schema: { type: "object", properties: { screen: { type: "string" } } },
      properties: { screen: "Opened screen" },
    });
    const tenantDefinition = defineProductEvent({
      name: "report.created",
      description: "A report was created after its transaction committed.",
      version: 1,
      subjectKind: "tenant",
      occurrence: "committed",
      scope: "tenant",
      owner: "reports",
      sourceLocation: "src/reports/ReportService.ts:24",
      schema: { type: "object", properties: { reportId: { type: "string" } } },
      properties: { reportId: "Created report ID" },
    });
    const manager = { captureValidatedEnvelope: vi.fn(() => true) } as unknown as AnalyticsManager;
    const catalog = new ProductEventCatalog([appDefinition, tenantDefinition], manager);
    const receipt = catalog.captureTyped(
      appDefinition,
      { screen: "home" },
      {
        appId: appScope.appId,
        environment: appScope.environment,
        subject: { kind: "anonymous", id: "visitor-1" },
        eventId: "event-1",
        occurredAt: "2026-09-25T00:00:00.000Z",
      },
    );
    const source = createInProcessEventCatalogSource(catalog);
    const app = await loadEventCatalog({
      ...appScope,
      principalId: access.principalId,
      grantedPermissions: ["analytics:app:read"],
      source,
    });
    const tenant = await loadEventCatalog({ ...access, source });
    const crossScopeValidation = await validateEventCatalogPayload({
      ...appScope,
      principalId: access.principalId,
      grantedPermissions: ["analytics:app:validate"],
      source,
      name: "report.created",
      version: 1,
      payload: { reportId: "report-1" },
    });

    expect(receipt.status).toBe("accepted");
    expect(app).toMatchObject({
      kind: "ready",
      entries: [
        {
          descriptor: { name: "app.opened", scope: "app" },
          observation: { kind: "observed", receivedCount: 1 },
        },
      ],
    });
    expect(tenant).toMatchObject({
      kind: "ready",
      entries: [
        {
          descriptor: { name: "report.created", scope: "tenant" },
          observation: { kind: "unobserved" },
        },
      ],
    });
    expect(crossScopeValidation).toMatchObject({ kind: "not-found", delivery: "not-sent" });
  });

  it("uses a real product event catalog for server-side validation", async () => {
    const definition = defineProductEvent({
      name: "report.created",
      description: "A report was created after its transaction committed.",
      version: 1,
      subjectKind: "tenant",
      occurrence: "committed",
      scope: "tenant",
      owner: "reports",
      sourceLocation: "src/reports/ReportService.ts:24",
      schema: { type: "object", properties: { reportId: { type: "string" } } },
      properties: { reportId: "Created report ID" },
    });
    const captureValidatedEnvelope = vi.fn(() => true);
    const manager = { captureValidatedEnvelope } as unknown as AnalyticsManager;
    const catalog: EventCatalogRegistry = new ProductEventCatalog([definition], manager);
    const source = createSource(catalog);
    const serialized = structuredClone(
      await source.load({
        scope,
        principalId: access.principalId,
        grantedPermissions: access.grantedPermissions,
      }),
    );
    const state = await loadEventCatalog({ ...access, source });
    const invalid = await validateEventCatalogPayload({
      ...access,
      source,
      name: "report.created",
      version: 1,
      payload: { reportId: 42 },
    });

    expect(state).toMatchObject({
      kind: "ready",
      entries: [{ observation: { kind: "unobserved" } }],
    });
    expect(invalid).toMatchObject({
      kind: "invalid",
      delivery: "not-sent",
      problem: { code: "analytics-core/product-event-property-invalid" },
    });
    expect(serialized).toMatchObject({
      kind: "ready",
      entries: [{ descriptor: { name: "report.created" } }],
    });
    expect(captureValidatedEnvelope).not.toHaveBeenCalled();
  });

  it("keeps unobserved and observed with zero receipts distinct", async () => {
    const unobserved = await loadEventCatalog({
      ...access,
      source: createSource(createRegistry(false)),
    });
    const observed = await loadEventCatalog({
      ...access,
      source: createSource(createRegistry(true)),
    });

    expect(unobserved.kind).toBe("ready");
    expect(observed.kind).toBe("ready");
    if (unobserved.kind !== "ready" || observed.kind !== "ready") {
      return;
    }
    expect(unobserved.entries[0]?.observation).toEqual({ kind: "unobserved" });
    expect(observed.entries[0]?.observation).toEqual({
      kind: "observed",
      receivedCount: 0,
      recentFailureCodes: [],
    });
    expect(observed.entries[0]?.descriptor.schema).toEqual(descriptor.schema);
  });

  it.each([
    { label: "negative count", count: -1 },
    { label: "fractional count", count: 0.5 },
    { label: "unsafe count", count: Number.MAX_SAFE_INTEGER + 1 },
    { label: "non-finite count", count: Number.NaN },
    { label: "timestamp without receipts", count: 0, lastReceivedAt: "2026-09-25T00:00:00.000Z" },
  ])("rejects a source observation with $label", async ({ count, lastReceivedAt }) => {
    const catalog: EventCatalogRegistry = {
      ...createRegistry(true),
      getObservation: () => ({
        kind: "observed",
        receivedCount: count,
        lastReceivedAt,
        recentFailureCodes: [],
      }),
    };

    const state = await loadEventCatalog({ ...access, source: createSource(catalog) });

    expect(state).toMatchObject({
      kind: "problem",
      problem: { code: "admin-core/event-catalog-observation-invalid", status: 502 },
    });
  });

  it.each([
    { label: "missing failure codes", observation: { kind: "observed", receivedCount: 1 } },
    {
      label: "non-string failure code",
      observation: { kind: "observed", receivedCount: 1, recentFailureCodes: [42] },
    },
    {
      label: "non-string timestamp",
      observation: {
        kind: "observed",
        receivedCount: 1,
        recentFailureCodes: [],
        lastReceivedAt: 42,
      },
    },
    { label: "null observation", observation: null },
  ])("rejects $label from a remote catalog source", async ({ observation }) => {
    const catalog: EventCatalogRegistry = {
      ...createRegistry(true),
      getObservation: () => observation as never,
    };

    const state = await loadEventCatalog({ ...access, source: createSource(catalog) });

    expect(state).toMatchObject({
      kind: "problem",
      problem: { code: "admin-core/event-catalog-observation-invalid", status: 502 },
    });
  });

  it("keeps the source timestamp when receipts are present", async () => {
    const catalog: EventCatalogRegistry = {
      ...createRegistry(true),
      getObservation: () => ({
        kind: "observed",
        receivedCount: 1,
        lastReceivedAt: "2026-09-25T00:00:00.000Z",
        recentFailureCodes: ["analytics-core/product-event-property-invalid"],
      }),
    };

    const state = await loadEventCatalog({ ...access, source: createSource(catalog) });

    expect(state).toMatchObject({
      kind: "ready",
      entries: [
        {
          observation: {
            kind: "observed",
            receivedCount: 1,
            lastReceivedAt: "2026-09-25T00:00:00.000Z",
            recentFailureCodes: ["analytics-core/product-event-property-invalid"],
          },
        },
      ],
    });
  });

  it("checks read permission before consulting the source", async () => {
    const source = createSource(createRegistry(false));
    const state = await loadEventCatalog({ ...access, grantedPermissions: [], source });

    expect(state).toMatchObject({
      kind: "permission-denied",
      requiredPermissions: ["analytics:read"],
    });
    expect(source.load).not.toHaveBeenCalled();
  });

  it("does not accept tenant grants for app-wide catalog access", async () => {
    const source = createSource(createRegistry(false));
    const appAccess = {
      ...appScope,
      principalId: access.principalId,
      grantedPermissions: ["analytics:read", "analytics:validate"],
      source,
    };
    const read = await loadEventCatalog(appAccess);
    const validation = await validateEventCatalogPayload({
      ...appAccess,
      name: "app.opened",
      version: 1,
      payload: {},
    });

    expect(read).toMatchObject({
      kind: "permission-denied",
      requiredPermissions: ["analytics:app:read"],
    });
    expect(validation).toMatchObject({
      kind: "permission-denied",
      requiredPermissions: ["analytics:app:validate"],
    });
    expect(source.load).not.toHaveBeenCalled();
    expect(source.validate).not.toHaveBeenCalled();
  });

  it("rejects a descriptor from a different scope in a source response", async () => {
    const base = createSource(createRegistry(false));
    const source: EventCatalogSource = {
      ...base,
      load: async ({ scope: requestedScope }) => ({
        kind: "ready",
        scope: requestedScope,
        entries: [{ descriptor, observation: { kind: "unobserved" } }],
      }),
    };

    const state = await loadEventCatalog({
      ...appScope,
      principalId: access.principalId,
      grantedPermissions: ["analytics:app:read"],
      source,
    });

    expect(state).toMatchObject({
      kind: "problem",
      problem: { code: "admin-core/event-catalog-descriptor-scope-invalid", status: 502 },
    });
  });

  it("distinguishes an empty catalog, unsupported source, and source failure", async () => {
    const empty = await loadEventCatalog({
      ...access,
      source: createSource({ ...createRegistry(false), listDescriptors: () => [] }),
    });
    const unsupportedSource: EventCatalogSource = {
      load: async ({ scope: requestedScope }) => ({ kind: "unsupported", scope: requestedScope }),
      validate: async ({ scope: requestedScope }) => ({
        kind: "unsupported",
        scope: requestedScope,
      }),
    };
    const unsupported = await loadEventCatalog({ ...access, source: unsupportedSource });
    const failingSource: EventCatalogSource = {
      load: async () => {
        throw new Error("provider secret must not be exposed");
      },
      validate: async () => {
        throw new Error("provider secret must not be exposed");
      },
    };
    const failure = await loadEventCatalog({ ...access, source: failingSource });

    expect(empty).toMatchObject({ kind: "empty", scope });
    expect(unsupported).toMatchObject({
      kind: "unsupported",
      problem: { code: "admin-core/event-catalog-unsupported" },
    });
    expect(failure).toMatchObject({
      kind: "problem",
      problem: { code: "admin-core/event-catalog-source-failed", retryable: true },
    });
    expect(JSON.stringify(failure)).not.toContain("provider secret");
  });

  it("fails closed when a catalog source returns an unknown load kind", async () => {
    const base = createSource(createRegistry(false));
    const source: EventCatalogSource = {
      ...base,
      load: async () => ({ kind: "unavailable", scope }) as unknown as EventCatalogSourceLoadResult,
    };

    const state = await loadEventCatalog({ ...access, source });

    expect(state).toMatchObject({
      kind: "problem",
      problem: { code: "admin-core/event-catalog-load-result-invalid", status: 502 },
    });
  });

  it.each([
    { label: "null", sourceScope: null },
    { label: "malformed", sourceScope: { ...scope, tenantId: 42 } },
  ])("rejects $label source scopes in both operations", async ({ sourceScope }) => {
    const base = createSource(createRegistry(false));
    const source: EventCatalogSource = {
      ...base,
      load: async () =>
        ({
          kind: "ready",
          scope: sourceScope,
          entries: [],
        }) as unknown as EventCatalogSourceLoadResult,
      validate: async () =>
        ({ kind: "valid", scope: sourceScope }) as unknown as EventCatalogSourceValidationResult,
    };

    await expect(loadEventCatalog({ ...access, source })).rejects.toThrow(
      EventCatalogValidationProblem,
    );
    await expect(
      validateEventCatalogPayload({
        ...access,
        source,
        name: "report.created",
        version: 1,
        payload: {},
      }),
    ).rejects.toThrow(EventCatalogValidationProblem);
  });

  it("preserves available entries and the source problem in a partial response", async () => {
    const base = createSource(createRegistry(false));
    const problem = { code: "analytics-core/catalog-read-incomplete", status: 503 };
    const source: EventCatalogSource = {
      ...base,
      load: async ({ scope: requestedScope }) => ({
        kind: "partial",
        scope: requestedScope,
        entries: [{ descriptor, observation: { kind: "unobserved" } }],
        problem,
      }),
    };

    const state = await loadEventCatalog({ ...access, source });

    expect(state).toMatchObject({
      kind: "partial",
      scope,
      entries: [{ descriptor, observation: { kind: "unobserved" } }],
      problem,
    });
  });

  it("keeps a partial response with no entries distinct from an empty catalog", async () => {
    const base = createSource(createRegistry(false));
    const source: EventCatalogSource = {
      ...base,
      load: async ({ scope: requestedScope }) => ({
        kind: "partial",
        scope: requestedScope,
        entries: [],
        problem: { code: "analytics-core/catalog-read-incomplete", status: 503 },
      }),
    };

    const state = await loadEventCatalog({ ...access, source });

    expect(state).toMatchObject({
      kind: "partial",
      entries: [],
      problem: { code: "analytics-core/catalog-read-incomplete" },
    });
  });

  it("rejects invalid observation data in a partial response", async () => {
    const base = createSource(createRegistry(false));
    const source: EventCatalogSource = {
      ...base,
      load: async ({ scope: requestedScope }) => ({
        kind: "partial",
        scope: requestedScope,
        entries: [
          {
            descriptor,
            observation: { kind: "observed", receivedCount: -1, recentFailureCodes: [] },
          },
        ],
        problem: { code: "analytics-core/catalog-read-incomplete", status: 503 },
      }),
    };

    const state = await loadEventCatalog({ ...access, source });

    expect(state).toMatchObject({
      kind: "problem",
      problem: { code: "admin-core/event-catalog-observation-invalid" },
    });
  });

  it("validates a payload with the catalog validator and never dispatches it", async () => {
    const catalog = createRegistry(false);
    const validatePayload = vi.spyOn(catalog, "validatePayload");
    const source = createSource(catalog);
    const valid = await validateEventCatalogPayload({
      ...access,
      source,
      name: "report.created",
      version: 1,
      payload: { reportId: "report-1" },
    });
    const invalid = await validateEventCatalogPayload({
      ...access,
      source,
      name: "report.created",
      version: 1,
      payload: {},
    });

    expect(valid).toMatchObject({ kind: "valid", delivery: "not-sent" });
    expect(invalid).toMatchObject({
      kind: "invalid",
      delivery: "not-sent",
      problem: { code: "analytics-core/event-payload-invalid" },
    });
    expect(validatePayload).toHaveBeenCalledTimes(2);
    expect(source.validate).toHaveBeenCalledWith({
      scope,
      principalId: "operator-1",
      grantedPermissions: access.grantedPermissions,
      name: "report.created",
      version: 1,
      payload: {},
      signal: undefined,
    });
    expect(source.load).not.toHaveBeenCalled();
  });

  it("waits for the async validation source before reporting success", async () => {
    let completeValidation: ((result: EventCatalogSourceValidationResult) => void) | undefined;
    const pending = new Promise<EventCatalogSourceValidationResult>((resolve) => {
      completeValidation = resolve;
    });
    const base = createSource(createRegistry(false));
    const source: EventCatalogSource = { ...base, validate: vi.fn(() => pending) };
    const result = validateEventCatalogPayload({
      ...access,
      source,
      name: "report.created",
      version: 1,
      payload: { reportId: "report-1" },
    });
    let settled = false;
    void result.then(() => {
      settled = true;
    });

    await Promise.resolve();
    expect(source.validate).toHaveBeenCalledWith({
      scope,
      principalId: access.principalId,
      grantedPermissions: access.grantedPermissions,
      name: "report.created",
      version: 1,
      payload: { reportId: "report-1" },
      signal: undefined,
    });
    expect(settled).toBe(false);
    expect(source.load).not.toHaveBeenCalled();

    completeValidation?.({ kind: "valid", scope });
    await expect(result).resolves.toMatchObject({ kind: "valid", delivery: "not-sent" });
  });

  it("rejects a validation result from another tenant", async () => {
    const base = createSource(createRegistry(false));
    const source: EventCatalogSource = {
      ...base,
      validate: async () => ({ kind: "valid", scope: { ...scope, tenantId: "tenant-2" } }),
    };

    await expect(
      validateEventCatalogPayload({
        ...access,
        source,
        name: "report.created",
        version: 1,
        payload: {},
      }),
    ).rejects.toThrow(EventCatalogValidationProblem);
  });

  it("reports unsupported, declared problems, and failed validation sources", async () => {
    const base = createSource(createRegistry(false));
    const request = { ...access, name: "report.created", version: 1, payload: {} };
    const unsupported = await validateEventCatalogPayload({
      ...request,
      source: {
        ...base,
        validate: async () => ({ kind: "unsupported", scope }),
      },
    });
    const declared = await validateEventCatalogPayload({
      ...request,
      source: {
        ...base,
        validate: async () => ({
          kind: "problem",
          scope,
          problem: { code: "analytics-core/validation-unavailable", status: 503 },
        }),
      },
    });
    const failed = await validateEventCatalogPayload({
      ...request,
      source: {
        ...base,
        validate: async () => {
          throw new Error("provider secret must not be exposed");
        },
      },
    });

    expect(unsupported).toMatchObject({
      kind: "unsupported",
      problem: { code: "admin-core/event-catalog-unsupported" },
    });
    expect(declared).toMatchObject({
      kind: "problem",
      problem: { code: "analytics-core/validation-unavailable" },
    });
    expect(failed).toMatchObject({
      kind: "problem",
      problem: { code: "admin-core/event-catalog-validation-source-failed", retryable: true },
    });
    expect(JSON.stringify(failed)).not.toContain("provider secret");
  });

  it("fails closed when a validation source returns an unknown result kind", async () => {
    const base = createSource(createRegistry(false));
    const source: EventCatalogSource = {
      ...base,
      validate: async () =>
        ({ kind: "unavailable", scope }) as unknown as EventCatalogSourceValidationResult,
    };

    const state = await validateEventCatalogPayload({
      ...access,
      source,
      name: "report.created",
      version: 1,
      payload: { reportId: "report-1" },
    });

    expect(state).toMatchObject({
      kind: "problem",
      problem: { code: "admin-core/event-catalog-validation-result-invalid", status: 502 },
    });
  });

  it("rejects unknown versions before validation", async () => {
    const catalog = createRegistry(false);
    const validatePayload = vi.spyOn(catalog, "validatePayload");
    const state = await validateEventCatalogPayload({
      ...access,
      source: createSource(catalog),
      name: "report.created",
      version: 2,
      payload: { reportId: "report-1" },
    });

    expect(state).toMatchObject({
      kind: "not-found",
      delivery: "not-sent",
      problem: { code: "admin-core/event-catalog-version-not-found" },
    });
    expect(validatePayload).not.toHaveBeenCalled();
  });

  it("checks validation permission before consulting the source", async () => {
    const source = createSource(createRegistry(false));
    const state = await validateEventCatalogPayload({
      ...access,
      grantedPermissions: ["analytics:read"],
      source,
      name: "report.created",
      version: 1,
      payload: {},
    });

    expect(state).toMatchObject({
      kind: "permission-denied",
      requiredPermissions: ["analytics:validate"],
    });
    expect(source.validate).not.toHaveBeenCalled();
  });

  it("rejects a source result from another tenant", async () => {
    const source: EventCatalogSource = {
      load: async () => ({
        kind: "ready",
        scope: { ...scope, tenantId: "tenant-2" },
        entries: [],
      }),
      validate: async ({ scope: requestedScope }) => ({ kind: "valid", scope: requestedScope }),
    };

    await expect(loadEventCatalog({ ...access, source })).rejects.toThrow(
      EventCatalogValidationProblem,
    );
  });

  it("requires an explicit tenant", async () => {
    const source = createSource(createRegistry(false));

    await expect(loadEventCatalog({ ...access, tenantId: "", source })).rejects.toThrow(
      EventCatalogValidationProblem,
    );
    expect(source.load).not.toHaveBeenCalled();
  });

  it("rejects an app request that also carries a tenant", async () => {
    const source = createSource(createRegistry(false));
    const malformed = {
      ...appScope,
      tenantId: "tenant-1",
      principalId: access.principalId,
      grantedPermissions: ["analytics:app:read"],
      source,
    };

    await expect(loadEventCatalog(malformed)).rejects.toThrow(EventCatalogValidationProblem);
    expect(source.load).not.toHaveBeenCalled();
  });

  it("requires a positive integer event version", async () => {
    const source = createSource(createRegistry(false));

    await expect(
      validateEventCatalogPayload({
        ...access,
        source,
        name: "report.created",
        version: 0,
        payload: {},
      }),
    ).rejects.toThrow(EventCatalogValidationProblem);
    expect(source.validate).not.toHaveBeenCalled();
  });
});
