import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { buildContractGraph, formatContractDiagnostic } from "../libs/ContractGraph";
import {
  defineContractMonetization,
  isContractMonetizationInput,
  runContractMonetizationProviderPreflight,
} from "../libs/ContractGraphMonetization";
import {
  createContractGraphSnapshot,
  isContractGraphSnapshot,
  stringifyContractGraphSnapshot,
} from "../libs/ContractGraphSnapshot";
import { Controller, Get } from "./helpers/test-decorators";

const usageMeter = {
  key: "api.calls",
  aggregation: "COUNT" as const,
  unit: "request",
  billing: "required" as const,
};

const polarCheckoutOnly = {
  providerName: "polar",
  capabilities: {
    checkout: { supported: true },
    usage: { supported: false, reason: "Usage ingestion is unavailable." },
  },
};

function createPlan(ref = "pro@2026-01") {
  return {
    ref,
    planId: "pro",
    rating: { mode: "provider" as const, provider: "polar" },
    providerBindings: [
      {
        provider: "polar",
        productId: "product-pro",
        priceIds: ["price-pro"],
      },
    ],
  };
}

function createCompleteInput() {
  const plan = createPlan();

  return defineContractMonetization({
    meters: [usageMeter],
    planVersions: [{ plan, billedMeters: [usageMeter] }],
    entitlementSets: [
      {
        planId: "pro",
        planVersionRef: plan.ref,
        entitlements: [
          {
            featureKey: "reports",
            type: "metered" as const,
            meterId: usageMeter.key,
            meterBilling: "required" as const,
            quota: 100,
            overagePolicy: "ALLOW_WITH_OVERAGE" as const,
          },
        ],
      },
    ],
    providers: [
      {
        providerName: "polar",
        capabilities: {
          checkout: { supported: true },
          usage: { supported: true },
        },
      },
    ],
    providerMappings: [
      {
        provider: "polar",
        planVersionRef: plan.ref,
        productId: "product-pro",
        priceIds: ["price-pro"],
        meterBindings: [{ meter: usageMeter, externalMeterId: "polar-api-calls" }],
      },
    ],
  });
}

describe("ContractGraph monetization", () => {
  it("does not change route-only graphs when monetization is unused", () => {
    expect(buildContractGraph([]).monetization).toBeUndefined();
  });

  it("resolves legacy string meter metadata through an explicit typed declaration", () => {
    @Controller("/legacy")
    class LegacyController {
      @Get("/")
      usage(): void {}
    }

    Reflect.defineMetadata(
      Symbol.for("croco:metering:metered"),
      { meterId: usageMeter.key },
      LegacyController.prototype,
      "usage",
    );

    const graph = buildContractGraph([LegacyController], { monetization: createCompleteInput() });

    expect(graph.diagnostics).toEqual([]);
    expect(graph.monetization?.edges).toContainEqual({
      type: "operation-records-meter",
      from: "operation:LegacyController_usage",
      to: "meter:api.calls",
    });
  });

  it("normalizes a typed meter reference and its route metadata to one declaration", () => {
    const typedMeter = {
      ...usageMeter,
      dimensions: { model: ["gpt-5", "gpt-5-mini"] as const },
    };

    @Controller("/typed")
    class TypedController {
      @Get("/")
      usage(): void {}
    }

    Reflect.defineMetadata(
      Symbol.for("croco:metering:metered"),
      { meterId: typedMeter.key, meter: typedMeter },
      TypedController.prototype,
      "usage",
    );
    const complete = createCompleteInput();
    const graph = buildContractGraph([TypedController], {
      monetization: defineContractMonetization({
        ...complete,
        meters: [typedMeter],
      }),
    });

    expect(graph.diagnostics).toEqual([]);
    expect(graph.monetization?.nodes.filter((node) => node.id === "meter:api.calls")).toHaveLength(
      1,
    );
  });

  it("emits deterministic nodes and operation edges from shared Metered metadata", () => {
    @Controller("/reports")
    class ReportsController {
      @Get("/")
      listReports(): void {}
    }

    Reflect.defineMetadata(
      Symbol.for("croco:metering:metered"),
      { meterId: usageMeter.key, meter: usageMeter },
      ReportsController.prototype,
      "listReports",
    );

    const complete = createCompleteInput();
    const secondPlan = createPlan("pro@2026-02");
    const input = defineContractMonetization({
      meters: [
        ...(complete.meters ?? []),
        { key: "audit.events", aggregation: "COUNT", unit: "event", billing: "local" },
      ],
      planVersions: [
        ...(complete.planVersions ?? []),
        { plan: secondPlan, billedMeters: [usageMeter] },
      ],
      entitlementSets: [
        ...(complete.entitlementSets ?? []),
        { planId: "pro", planVersionRef: secondPlan.ref, entitlements: [] },
      ],
      providers: [
        ...(complete.providers ?? []),
        {
          providerName: "offline",
          capabilities: {
            checkout: { supported: false, reason: "Not configured." },
            usage: { supported: false, reason: "Not configured." },
          },
        },
      ],
      providerMappings: [
        ...(complete.providerMappings ?? []),
        {
          provider: "polar",
          planVersionRef: secondPlan.ref,
          productId: "product-pro",
          priceIds: ["price-pro"],
          meterBindings: [{ meter: usageMeter, externalMeterId: "polar-api-calls" }],
        },
      ],
    });
    const reversed = defineContractMonetization({
      meters: [...(input.meters ?? [])].reverse(),
      planVersions: [...(input.planVersions ?? [])].reverse(),
      entitlementSets: [...(input.entitlementSets ?? [])].reverse(),
      providers: [...(input.providers ?? [])].reverse(),
      providerMappings: [...(input.providerMappings ?? [])].reverse(),
    });
    const first = buildContractGraph([ReportsController], { monetization: input });
    const second = buildContractGraph([ReportsController], { monetization: reversed });

    expect(first.monetization).toBeDefined();
    expect(first.monetization).toEqual(second.monetization);
    expect(first.monetization?.validationSource).toBe("credential-free-structural");
    expect(first.monetization?.edges).toContainEqual({
      type: "operation-records-meter",
      from: "operation:ReportsController_listReports",
      to: "meter:api.calls",
    });
    expect(first.monetization?.edges).toContainEqual({
      type: "plan-version-grants-entitlement",
      from: "plan-version:pro@2026-01",
      to: "entitlement-set:pro@2026-01",
    });
    const nodeIds = new Set(first.monetization?.nodes.map((node) => node.id));
    for (const edge of first.monetization?.edges ?? []) {
      if (edge.type !== "operation-records-meter") {
        expect(nodeIds.has(edge.from)).toBe(true);
      }
      expect(nodeIds.has(edge.to)).toBe(true);
    }
    expect(first.diagnostics).toEqual([]);
  });

  it("normalizes absolute source paths without timestamps or machine roots", () => {
    const first = buildContractGraph([], {
      monetization: defineContractMonetization({
        meters: [
          {
            ...usageMeter,
            sourceLocation: { path: "/tmp/first/src/contracts/meters.ts", line: 3 },
          },
        ],
      }),
    });
    const second = buildContractGraph([], {
      monetization: defineContractMonetization({
        meters: [
          {
            ...usageMeter,
            sourceLocation: { path: "/work/second/src/contracts/meters.ts", line: 3 },
          },
        ],
      }),
    });
    const relative = buildContractGraph([], {
      monetization: defineContractMonetization({
        meters: [
          {
            ...usageMeter,
            sourceLocation: { path: "src/contracts/meters.ts", line: 3 },
          },
        ],
      }),
    });

    expect(first.monetization).toEqual(second.monetization);
    expect(first.monetization).toEqual(relative.monetization);
    expect(JSON.stringify(first.monetization)).not.toContain("/tmp/first");
    expect(JSON.stringify(first.monetization)).not.toMatch(/checkedAt|timestamp/i);
  });

  it("rejects required meters that no plan bills", () => {
    const graph = buildContractGraph([], {
      monetization: defineContractMonetization({ meters: [usageMeter] }),
    });

    expect(graph.diagnostics).toEqual([
      expect.objectContaining({
        code: "CROCO_BILLING_METER_UNBOUND",
        target: "meter",
        source: "credential-free-structural",
        recovery: expect.objectContaining({ action: expect.stringContaining("billedMeters") }),
      }),
    ]);
    expect(formatContractDiagnostic(graph.diagnostics[0])).toContain("Recovery:");
  });

  it("rejects plan and provider edges that reference undeclared meters", () => {
    const plan = {
      ref: "pro@2026-01",
      planId: "pro",
      rating: { mode: "croco" as const },
      providerBindings: [],
    };
    const graph = buildContractGraph([], {
      monetization: defineContractMonetization({
        planVersions: [{ plan, billedMeters: ["missing.meter"] }],
      }),
    });

    expect(graph.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "CROCO_BILLING_METER_UNBOUND",
        contractId: "plan-version:pro@2026-01",
        evidence: expect.objectContaining({ kind: "plan-meter-declaration" }),
      }),
    );
  });

  it("deduplicates equivalent declarations and rejects conflicting identities", () => {
    const equivalent = buildContractGraph([], {
      monetization: defineContractMonetization({ meters: [usageMeter, { ...usageMeter }] }),
    });
    const conflictingInput = defineContractMonetization({
      meters: [usageMeter, { ...usageMeter, billing: "local" as const }],
    });
    const first = buildContractGraph([], { monetization: conflictingInput });
    const second = buildContractGraph([], {
      monetization: defineContractMonetization({
        meters: [...(conflictingInput.meters ?? [])].reverse(),
      }),
    });

    expect(equivalent.monetization?.nodes).toHaveLength(1);
    expect(equivalent.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "CROCO_BILLING_METER_UNBOUND",
    ]);
    expect(first.monetization).toEqual(second.monetization);
    expect(first.diagnostics).toEqual(second.diagnostics);
    expect(first.diagnostics).toContainEqual(
      expect.objectContaining({ code: "CROCO_BILLING_DECLARATION_CONFLICT" }),
    );
  });

  it("rejects billable overage without a complete provider meter path", () => {
    const plan = createPlan();
    const graph = buildContractGraph([], {
      monetization: defineContractMonetization({
        meters: [usageMeter],
        planVersions: [{ plan, billedMeters: [usageMeter] }],
        entitlementSets: [
          {
            planId: "pro",
            planVersionRef: plan.ref,
            entitlements: [
              {
                featureKey: "reports",
                type: "metered",
                meterId: usageMeter.key,
                meterBilling: "required",
                quota: 100,
                overagePolicy: "ALLOW_WITH_OVERAGE",
              },
            ],
          },
        ],
        providers: [polarCheckoutOnly],
        providerMappings: [
          {
            provider: "polar",
            planVersionRef: plan.ref,
            productId: "product-pro",
            priceIds: ["price-pro"],
          },
        ],
      }),
    });

    expect(graph.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "CROCO_BILLING_METER_UNBOUND",
      "CROCO_BILLING_PROVIDER_CAPABILITY_MISSING",
    ]);
  });

  it("rejects provider and entitlement mappings that resolve different immutable versions", () => {
    const plan = createPlan("pro@2026-02");
    const graph = buildContractGraph([], {
      monetization: defineContractMonetization({
        meters: [usageMeter],
        planVersions: [{ plan, billedMeters: [usageMeter] }],
        entitlementSets: [{ planId: "pro", planVersionRef: "pro@2026-01", entitlements: [] }],
        providers: [
          {
            providerName: "polar",
            capabilities: {
              checkout: { supported: true },
              usage: { supported: true },
            },
          },
        ],
        providerMappings: [
          {
            provider: "polar",
            planVersionRef: plan.ref,
            productId: "product-pro",
            priceIds: ["price-pro"],
          },
        ],
      }),
    });

    expect(graph.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "CROCO_BILLING_ENTITLEMENT_VERSION_MISMATCH" }),
      ]),
    );
  });

  it("reports unmapped provider rating and conflicting provider bindings independently", () => {
    const plan = {
      ...createPlan(),
      providerBindings: [
        {
          provider: "stripe",
          productId: "product-pro",
          priceIds: ["price-pro"],
        },
      ],
    };
    const graph = buildContractGraph([], {
      monetization: defineContractMonetization({
        planVersions: [{ plan }],
        entitlementSets: [{ planId: "pro", planVersionRef: plan.ref, entitlements: [] }],
        providers: [
          {
            providerName: "stripe",
            capabilities: {
              checkout: { supported: true },
              usage: { supported: true },
            },
          },
        ],
        providerMappings: [
          {
            provider: "stripe",
            planVersionRef: plan.ref,
            productId: "product-pro",
            priceIds: ["price-pro"],
          },
        ],
      }),
    });

    expect(graph.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "CROCO_BILLING_PLAN_VERSION_UNMAPPED",
      "CROCO_BILLING_RATING_MODE_CONFLICT",
    ]);
  });

  it("does not auto-discover malformed version-tagged exports", () => {
    expect(
      isContractMonetizationInput({
        version: "croco.contract-monetization.input.v1",
        meters: [{ key: "api.calls" }],
      }),
    ).toBe(false);
  });

  it("keeps remote provider preflight opt-in and separate from structural validation", async () => {
    const graph = buildContractGraph([], { monetization: createCompleteInput() });
    const inspect = vi.fn(async () => [
      {
        code: "CROCO_BILLING_PROVIDER_MAPPING_DRIFT",
        severity: "error" as const,
        message: "Polar price price-pro is missing.",
        contractId: "provider-mapping:polar:pro@2026-01:product-pro",
        evidence: { kind: "remote-provider-object", references: ["price-pro"] },
        recovery: { action: "Restore the remote price or publish a corrected mapping." },
      },
    ]);

    expect(inspect).not.toHaveBeenCalled();
    expect(graph.diagnostics).toEqual([]);
    expect(graph.monetization).toBeDefined();
    if (!graph.monetization) {
      return;
    }

    const report = await runContractMonetizationProviderPreflight(graph.monetization, {
      provider: "polar",
      inspect,
    });

    expect(inspect).toHaveBeenCalledOnce();
    expect(report).toMatchObject({
      provider: "polar",
      validationSource: "remote-provider-preflight",
      diagnostics: [
        expect.objectContaining({
          code: "CROCO_BILLING_PROVIDER_MAPPING_DRIFT",
          source: "remote-provider-preflight",
          target: "provider",
        }),
      ],
    });
  });

  it("persists the same monetization evidence in JSON snapshots", () => {
    const graph = buildContractGraph([], { monetization: createCompleteInput() });
    const snapshot = createContractGraphSnapshot(graph);
    const serialized = stringifyContractGraphSnapshot(snapshot);

    expect(isContractGraphSnapshot(JSON.parse(serialized))).toBe(true);
    expect(snapshot.monetization).toEqual(graph.monetization);
    expect(serialized).toContain("credential-free-structural");
    expect(serialized).not.toContain("remote configuration was inspected");
  });
});
