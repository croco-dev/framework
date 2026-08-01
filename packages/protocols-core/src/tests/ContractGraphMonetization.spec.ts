import "reflect-metadata";
import { describe, expect, it } from "vitest";
import { buildContractGraph, formatContractDiagnostics } from "../libs/ContractGraph";
import { diffContractGraphSnapshots } from "../libs/ContractGraphDiff";
import {
  CONTRACT_METERED_METADATA_KEY,
  defineContractMonetization,
  getContractProviderMappingDriftInput,
  isContractMonetizationDefinition,
} from "../libs/ContractGraphMonetization";
import {
  createContractGraphV1,
  createContractGraphSnapshot,
  isContractGraphV1,
  stringifyContractGraphV1,
} from "../libs/ContractGraphSnapshot";
import { Controller, Get } from "./helpers/test-decorators";

const billableMeter = {
  key: "api.calls",
  aggregation: "COUNT" as const,
  unit: "request",
  billing: "required" as const,
};

const usageProvider = {
  providerName: "usage-provider",
  capabilities: {
    checkout: { supported: true },
    usage: { supported: true },
  },
};

const planVersion = {
  ref: "pro@2026-08",
  planId: "pro",
  versionId: "2026-08",
  rating: { mode: "provider" as const, provider: "usage-provider" },
  providerBindings: [
    {
      provider: "usage-provider",
      productId: "product-pro",
      priceIds: ["price-pro"],
      meterBindings: [{ meterKey: "api.calls", meterId: "provider-api-calls" }],
    },
  ],
};

const entitlementSet = {
  planId: "pro",
  planVersionRef: "pro@2026-08",
  entitlements: [
    {
      featureKey: "api",
      type: "metered" as const,
      quota: 100,
      meterId: "api.calls",
      meterBilling: "required" as const,
      overagePolicy: "ALLOW_WITH_OVERAGE" as const,
    },
  ],
};

describe("ContractGraph monetization verification", () => {
  it("defines executable typed monetization input for verification-pipeline discovery", () => {
    const definition = defineContractMonetization({ meters: [billableMeter] });

    expect(isContractMonetizationDefinition(definition)).toBe(true);
    expect(definition).toEqual({
      kind: "croco.contract-monetization.v1",
      input: { meters: [billableMeter] },
    });
  });
  it("emits deterministic monetization nodes and edges from typed route and domain descriptors", () => {
    @Controller("/usage")
    class UsageController {
      @Get("/")
      record(): void {}
    }
    Reflect.defineMetadata(
      CONTRACT_METERED_METADATA_KEY,
      { meterId: billableMeter.key, meter: billableMeter },
      UsageController.prototype,
      "record",
    );

    const timestampedPlanVersion = {
      ...planVersion,
      effectiveAt: "2026-08-01T00:00:00.000Z",
    };
    const laterTimestampedPlanVersion = {
      ...planVersion,
      effectiveAt: "2030-01-01T00:00:00.000Z",
    };
    const input = {
      meters: [billableMeter],
      planVersions: [timestampedPlanVersion],
      entitlementSets: [entitlementSet],
      providers: [usageProvider],
    };
    const first = buildContractGraph([UsageController], { monetization: input });
    const second = buildContractGraph([UsageController], {
      monetization: {
        ...input,
        meters: [...input.meters].reverse(),
        planVersions: [laterTimestampedPlanVersion],
        providers: [...input.providers].reverse(),
      },
    });
    const firstMonetization = first.monetization;

    expect(firstMonetization).toBeDefined();
    if (!firstMonetization) return;

    expect(first.diagnostics).toEqual([]);
    expect(firstMonetization.verification).toEqual({
      mode: "credential-free-structural",
      remoteProviderConfigurationInspected: false,
    });
    expect(firstMonetization.nodes).not.toContainEqual(
      expect.objectContaining({ effectiveAt: expect.anything() }),
    );
    expect(firstMonetization.edges).toEqual(
      expect.arrayContaining([
        {
          kind: "operation-records-meter",
          from: "operation:UsageController.record",
          to: "meter:api.calls",
        },
        expect.objectContaining({
          kind: "plan-version-bills-meter",
          from: "plan-version:pro@2026-08",
          to: "meter:api.calls",
        }),
      ]),
    );
    const graphBeforePreflight = JSON.stringify(firstMonetization);
    expect(getContractProviderMappingDriftInput(firstMonetization, "usage-provider")).toEqual([
      {
        planVersionRef: "pro@2026-08",
        productId: "product-pro",
        priceIds: ["price-pro"],
        meterBindings: [{ meterKey: "api.calls", meterId: "provider-api-calls" }],
      },
    ]);
    expect(JSON.stringify(firstMonetization)).toBe(graphBeforePreflight);
    expect(stringifyContractGraphV1(createContractGraphV1(first))).toBe(
      stringifyContractGraphV1(createContractGraphV1(second)),
    );

    const malformed = JSON.parse(stringifyContractGraphV1(createContractGraphV1(first)));
    const planNode = malformed.monetization.nodes.find(
      (node: { kind?: string }) => node.kind === "plan-version",
    );
    planNode.providerBindings = [42];
    expect(isContractGraphV1(malformed)).toBe(false);
  });

  it("reports conflicting descriptors without making output declaration-order dependent", () => {
    const conflicting = { ...billableMeter, unit: "operation" };
    const first = buildContractGraph([], {
      monetization: { meters: [billableMeter, conflicting] },
    });
    const second = buildContractGraph([], {
      monetization: { meters: [conflicting, billableMeter] },
    });

    expect(first.diagnostics).toContainEqual(
      expect.objectContaining({ code: "CROCO_BILLING_DESCRIPTOR_CONFLICT" }),
    );
    expect(stringifyContractGraphV1(createContractGraphV1(first))).toBe(
      stringifyContractGraphV1(createContractGraphV1(second)),
    );
  });

  it("preserves typed meter dimensions and reviews dimension drift", () => {
    const regionalUs = {
      key: "api.regional",
      aggregation: "COUNT" as const,
      unit: "request",
      billing: "required" as const,
      dimensions: { region: { kind: "enum" as const, values: ["us"] } },
    };
    const regionalEu = {
      ...regionalUs,
      dimensions: { region: { kind: "enum" as const, values: ["eu"] } },
    };
    const first = buildContractGraph([], { monetization: { meters: [regionalUs] } });
    const second = buildContractGraph([], { monetization: { meters: [regionalEu] } });
    const conflicting = buildContractGraph([], {
      monetization: { meters: [regionalUs, regionalEu] },
    });

    expect(first.monetization?.nodes).toContainEqual(
      expect.objectContaining({
        key: "api.regional",
        dimensions: { region: { kind: "enum", values: ["us"] } },
      }),
    );
    expect(
      diffContractGraphSnapshots(
        createContractGraphSnapshot(first),
        createContractGraphSnapshot(second),
      ).changes,
    ).toContainEqual(expect.objectContaining({ code: "contract-monetization-changed" }));
    expect(conflicting.diagnostics).toContainEqual(
      expect.objectContaining({ code: "CROCO_BILLING_DESCRIPTOR_CONFLICT" }),
    );
  });

  it("uses a total canonical order for otherwise identical provider product bindings", () => {
    const bindings = [
      { provider: "usage-provider", productId: "product-pro", priceIds: ["price-b"] },
      { provider: "usage-provider", productId: "product-pro", priceIds: ["price-a"] },
    ];
    const build = (providerBindings: typeof bindings) =>
      buildContractGraph([], {
        monetization: {
          planVersions: [{ ...planVersion, providerBindings }],
          providers: [usageProvider],
        },
      });
    const first = build(bindings);
    const second = build([...bindings].reverse());

    expect(stringifyContractGraphV1(createContractGraphV1(first))).toBe(
      stringifyContractGraphV1(createContractGraphV1(second)),
    );
    expect(first.monetization).toBeDefined();
    expect(second.monetization).toBeDefined();
    if (!first.monetization || !second.monetization) return;
    expect(getContractProviderMappingDriftInput(first.monetization, "usage-provider")).toEqual(
      getContractProviderMappingDriftInput(second.monetization, "usage-provider"),
    );
  });

  it("orders conflicting nested meter and entitlement identities deterministically", () => {
    const meterBindings = [
      { meterKey: "api.calls", meterId: "provider-meter-b" },
      { meterKey: "api.calls", meterId: "provider-meter-a" },
    ];
    const entitlements = [
      { ...entitlementSet.entitlements[0], quota: 200 },
      { ...entitlementSet.entitlements[0], quota: 100 },
    ];
    const build = (reverse: boolean) =>
      buildContractGraph([], {
        monetization: {
          meters: [billableMeter],
          planVersions: [
            {
              ...planVersion,
              providerBindings: [
                {
                  ...planVersion.providerBindings[0],
                  meterBindings: reverse ? [...meterBindings].reverse() : meterBindings,
                },
              ],
            },
          ],
          entitlementSets: [
            {
              ...entitlementSet,
              entitlements: reverse ? [...entitlements].reverse() : entitlements,
            },
          ],
          providers: [usageProvider],
        },
      });
    const first = build(false);
    const second = build(true);

    expect(stringifyContractGraphV1(createContractGraphV1(first))).toBe(
      stringifyContractGraphV1(createContractGraphV1(second)),
    );
    expect(
      first.diagnostics.filter(({ code }) => code === "CROCO_BILLING_DESCRIPTOR_CONFLICT"),
    ).toHaveLength(2);
  });

  it("allows local blocking quotas without a provider meter binding", () => {
    const graph = buildContractGraph([], {
      monetization: {
        meters: [{ ...billableMeter, billing: "local" }],
        planVersions: [
          {
            ...planVersion,
            providerBindings: [{ ...planVersion.providerBindings[0], meterBindings: [] }],
          },
        ],
        entitlementSets: [
          {
            ...entitlementSet,
            entitlements: [
              {
                ...entitlementSet.entitlements[0],
                meterBilling: "local",
                overagePolicy: "BLOCK",
              },
            ],
          },
        ],
        providers: [usageProvider],
      },
    });

    expect(graph.diagnostics).toEqual([]);
  });

  it("treats version-bound quota drift as reviewed monetization contract drift", () => {
    const build = (quota: number) =>
      createContractGraphSnapshot(
        buildContractGraph([], {
          monetization: {
            meters: [billableMeter],
            planVersions: [planVersion],
            entitlementSets: [
              {
                ...entitlementSet,
                entitlements: [{ ...entitlementSet.entitlements[0], quota }],
              },
            ],
            providers: [usageProvider],
          },
        }),
      );

    expect(diffContractGraphSnapshots(build(100), build(200)).changes).toContainEqual({
      code: "contract-monetization-changed",
      severity: "breaking",
      message: "Monetization bindings changed from the reviewed contract snapshot.",
    });
  });

  it("requires review when a legacy snapshot first gains non-empty monetization bindings", () => {
    const current = createContractGraphSnapshot(
      buildContractGraph([], { monetization: { meters: [billableMeter] } }),
    );
    const legacy = { ...current, monetization: undefined };

    expect(diffContractGraphSnapshots(legacy, current).changes).toContainEqual(
      expect.objectContaining({ code: "contract-monetization-changed", severity: "breaking" }),
    );
  });

  it("rejects unbound required meters and overage without a provider billing path", () => {
    const graph = buildContractGraph([], {
      monetization: {
        meters: [billableMeter],
        planVersions: [{ ...planVersion, rating: { mode: "croco" }, providerBindings: [] }],
        entitlementSets: [entitlementSet],
        providers: [usageProvider],
      },
    });

    expect(graph.diagnostics.map(({ code }) => code)).toEqual([
      "CROCO_BILLING_METER_UNBOUND",
      "CROCO_BILLING_METER_UNBOUND",
      "CROCO_BILLING_PLAN_VERSION_UNMAPPED",
    ]);
    expect(formatContractDiagnostics(graph.diagnostics)).toContain("Recovery:");
  });

  it("rejects a usage-priced plan backed by a checkout-only provider", () => {
    const graph = buildContractGraph([], {
      monetization: {
        meters: [billableMeter],
        planVersions: [planVersion],
        entitlementSets: [entitlementSet],
        providers: [
          {
            ...usageProvider,
            capabilities: {
              checkout: { supported: true },
              usage: { supported: false, reason: "checkout only" },
            },
          },
        ],
      },
    });

    expect(graph.diagnostics).toEqual([
      expect.objectContaining({ code: "CROCO_BILLING_PROVIDER_CAPABILITY_MISSING" }),
    ]);
  });

  it("rejects version and rating ownership conflicts separately", () => {
    const graph = buildContractGraph([], {
      monetization: {
        meters: [billableMeter],
        planVersions: [
          {
            ...planVersion,
            rating: { mode: "croco" },
          },
        ],
        entitlementSets: [{ ...entitlementSet, planId: "enterprise" }],
        providers: [usageProvider],
        subscriptionMappings: [
          {
            subscriptionId: "subscription-1",
            entitlementPlanVersionRef: "pro@2026-07",
            providerPlanVersionRef: "pro@2026-08",
          },
        ],
      },
    });

    expect(graph.diagnostics.map(({ code }) => code)).toEqual([
      "CROCO_BILLING_ENTITLEMENT_VERSION_MISMATCH",
      "CROCO_BILLING_ENTITLEMENT_VERSION_MISMATCH",
      "CROCO_BILLING_PLAN_VERSION_UNMAPPED",
      "CROCO_BILLING_RATING_MODE_CONFLICT",
    ]);
  });

  it("rejects subscription mappings to an equally named unknown plan version", () => {
    const graph = buildContractGraph([], {
      monetization: {
        subscriptionMappings: [
          {
            subscriptionId: "subscription-ghost",
            entitlementPlanVersionRef: "ghost@1",
            providerPlanVersionRef: "ghost@1",
          },
        ],
      },
    });

    expect(graph.diagnostics).toEqual([
      expect.objectContaining({ code: "CROCO_BILLING_PLAN_VERSION_UNMAPPED" }),
    ]);
  });
});
