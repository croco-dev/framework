import { describe, expect, it } from "vitest";
import {
  InMemoryPlanRegistry,
  InvalidPlanVersionDefinitionProblem,
  migrateSubscriptionPlanVersion,
  planVersionRef,
  PlanVersionAlreadyPublishedProblem,
  PlanVersionConflictProblem,
  SubscriptionPlanVersionMismatchProblem,
  UnknownPlanVersionProblem,
  UnknownProviderPlanMappingProblem,
} from "../index";
import type { LegacySubscription, PlanVersionDefinition, PlanVersionRef } from "../types";

function createVersion(
  overrides: Partial<PlanVersionDefinition> & {
    ref?: PlanVersionRef;
  } = {},
): PlanVersionDefinition {
  return {
    ref: planVersionRef("pro@2026-01"),
    planId: "pro",
    versionId: "2026-01",
    effectiveAt: "2026-01-01T00:00:00.000Z",
    name: "Pro",
    amount: 9900,
    currency: "USD",
    interval: "month",
    intervalCount: 1,
    rating: { mode: "provider", provider: "polar" },
    providerBindings: [
      {
        provider: "polar",
        productId: "polar-pro-2026",
        priceIds: ["polar-price-2026"],
      },
    ],
    ...overrides,
    quantityPolicy: overrides.quantityPolicy ?? {
      minimumQuantity: 1,
      includedSeats: 0,
      seatQuota: 100,
      billableMembershipRoles: ["owner", "admin", "member"],
    },
  };
}

function createLegacySubscription(overrides: Partial<LegacySubscription> = {}): LegacySubscription {
  return {
    id: "subscription-1",
    billingAccountId: "account-1",
    externalSubscriptionId: "external-subscription-1",
    planId: "pro",
    status: "active",
    currentPeriodEnd: new Date("2026-02-01T00:00:00.000Z"),
    cancelAtPeriodEnd: false,
    lastSyncedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("InMemoryPlanRegistry", () => {
  it("returns identified historical versions without selecting a future version", async () => {
    const registry = new InMemoryPlanRegistry();
    const grandfathered = createVersion();
    const future = createVersion({
      ref: planVersionRef("pro@2027-01"),
      versionId: "2027-01",
      effectiveAt: "2027-01-01T00:00:00.000Z",
      amount: 12_900,
      providerBindings: [
        {
          provider: "polar",
          productId: "polar-pro-2027",
          priceIds: ["polar-price-2027"],
        },
      ],
    });

    await registry.publishPlanVersion(grandfathered);
    await registry.publishPlanVersion(future);

    await expect(registry.getPlan("pro")).resolves.toMatchObject({
      ref: grandfathered.ref,
      amount: 9900,
    });
    await expect(
      registry.getPlanAtDate("pro", new Date("2026-06-01T00:00:00.000Z")),
    ).resolves.toMatchObject({
      ref: grandfathered.ref,
      amount: 9900,
    });
    await expect(
      registry.getPlanAtDate("pro", new Date("2027-06-01T00:00:00.000Z")),
    ).resolves.toMatchObject({
      ref: future.ref,
      amount: 12_900,
    });
    await expect(
      registry.getPlanAtDate("pro", new Date("2025-12-31T23:59:59.999Z")),
    ).resolves.toBeNull();
  });

  it("copies and freezes published versions so callers cannot overwrite them", async () => {
    const registry = new InMemoryPlanRegistry();
    const input = createVersion({
      providerBindings: [
        {
          provider: "polar",
          productId: "polar-pro-2026",
          priceIds: ["polar-price-2026"],
          meterBindings: [{ meterKey: "api.calls", meterId: "polar-api-calls" }],
        },
      ],
    });
    await registry.publishPlanVersion(input);

    Object.defineProperty(input, "name", { value: "Mutated" });
    Object.defineProperty(input.providerBindings[0].priceIds, "0", {
      value: "mutated-price",
    });

    const published = await registry.getPlanVersion(input.ref);
    expect(published).toMatchObject({
      name: "Pro",
      providerBindings: [{ priceIds: ["polar-price-2026"] }],
    });
    expect(Object.isFrozen(published)).toBe(true);
    expect(Object.isFrozen(published?.providerBindings)).toBe(true);
    expect(Object.isFrozen(published?.providerBindings[0]?.priceIds)).toBe(true);
    expect(Object.isFrozen(published?.providerBindings[0]?.meterBindings)).toBe(true);
    expect(Object.isFrozen(published?.providerBindings[0]?.meterBindings?.[0])).toBe(true);
    expect(JSON.parse(JSON.stringify(published))).toMatchObject({
      ref: "pro@2026-01",
      effectiveAt: "2026-01-01T00:00:00.000Z",
      rating: { mode: "provider", provider: "polar" },
    });

    await expect(registry.publishPlanVersion(createVersion())).rejects.toBeInstanceOf(
      PlanVersionAlreadyPublishedProblem,
    );
  });

  it("rejects invalid or ambiguous provider meter bindings", async () => {
    const registry = new InMemoryPlanRegistry();
    const invalidBindings = [
      [{ meterKey: "", meterId: "provider-meter" }],
      [
        { meterKey: "api.calls", meterId: "provider-meter-a" },
        { meterKey: "api.calls", meterId: "provider-meter-b" },
      ],
      [
        { meterKey: "api.calls", meterId: "provider-meter" },
        { meterKey: "storage.bytes", meterId: "provider-meter" },
      ],
    ];

    for (const meterBindings of invalidBindings) {
      await expect(
        registry.publishPlanVersion(
          createVersion({
            providerBindings: [
              {
                provider: "polar",
                productId: "polar-pro-2026",
                priceIds: ["polar-price-2026"],
                meterBindings,
              },
            ],
          }),
        ),
      ).rejects.toBeInstanceOf(InvalidPlanVersionDefinitionProblem);
    }
  });

  it("resolves a provider product and price set to exactly one version", async () => {
    const registry = new InMemoryPlanRegistry();
    const version = createVersion();
    await registry.publishPlanVersion(version);

    await expect(
      registry.resolveProviderPlanVersion({
        provider: "polar",
        productId: "polar-pro-2026",
        priceIds: ["polar-price-2026"],
      }),
    ).resolves.toMatchObject({
      ref: version.ref,
      planId: "pro",
    });

    await expect(
      registry.resolveProviderPlanVersion({
        provider: "polar",
        productId: "unknown-product",
        priceIds: [],
      }),
    ).rejects.toMatchObject({
      code: "billing/unknown-provider-plan-mapping",
      status: 404,
    });
  });

  it("rejects duplicate provider mappings across published versions", async () => {
    const registry = new InMemoryPlanRegistry();
    await registry.publishPlanVersion(createVersion());

    await expect(
      registry.publishPlanVersion(
        createVersion({
          ref: planVersionRef("pro@2026-02"),
          versionId: "2026-02",
          effectiveAt: "2026-02-01T00:00:00.000Z",
        }),
      ),
    ).rejects.toMatchObject({
      code: "billing/plan-version-conflict",
      message: expect.stringContaining("already bound"),
    });
  });

  it("rejects ambiguous effective times within a plan family", async () => {
    const registry = new InMemoryPlanRegistry();
    await registry.publishPlanVersion(createVersion());

    await expect(
      registry.publishPlanVersion(
        createVersion({
          ref: planVersionRef("pro@same-effective-time"),
          versionId: "same-effective-time",
          providerBindings: [
            {
              provider: "polar",
              productId: "different-product",
              priceIds: ["different-price"],
            },
          ],
        }),
      ),
    ).rejects.toBeInstanceOf(PlanVersionConflictProblem);
  });

  it("rejects non-canonical effective times before they can become host-dependent", async () => {
    const registry = new InMemoryPlanRegistry();
    await registry.publishPlanVersion(createVersion());

    await expect(
      registry.publishPlanVersion(
        createVersion({
          ref: planVersionRef("pro@equivalent-effective-time"),
          versionId: "equivalent-effective-time",
          effectiveAt: "2026-01-01T00:00:00Z",
          providerBindings: [
            {
              provider: "polar",
              productId: "different-product",
              priceIds: ["different-price"],
            },
          ],
        }),
      ),
    ).rejects.toBeInstanceOf(InvalidPlanVersionDefinitionProblem);
  });

  it("rejects invalid provider-rated definitions", async () => {
    const registry = new InMemoryPlanRegistry();

    await expect(
      registry.publishPlanVersion(
        createVersion({
          rating: { mode: "provider", provider: "stripe" },
        }),
      ),
    ).rejects.toBeInstanceOf(InvalidPlanVersionDefinitionProblem);
  });

  it("rejects empty provider binding identifiers", async () => {
    const registry = new InMemoryPlanRegistry();

    await expect(
      registry.publishPlanVersion(
        createVersion({
          providerBindings: [
            {
              provider: "polar",
              productId: " ",
              priceIds: [""],
            },
          ],
        }),
      ),
    ).rejects.toBeInstanceOf(InvalidPlanVersionDefinitionProblem);
  });

  it("requires an internally valid quantity policy on every plan version", async () => {
    const registry = new InMemoryPlanRegistry();

    for (const quantityPolicy of [
      {
        minimumQuantity: -1,
        includedSeats: 0,
        seatQuota: 25,
        billableMembershipRoles: ["member"] as const,
      },
      {
        minimumQuantity: 1,
        includedSeats: -1,
        seatQuota: 25,
        billableMembershipRoles: ["member"] as const,
      },
      {
        minimumQuantity: 1,
        includedSeats: 0,
        seatQuota: -1,
        billableMembershipRoles: ["member"] as const,
      },
      {
        minimumQuantity: 1,
        includedSeats: 0,
        seatQuota: 25,
        billableMembershipRoles: [] as const,
      },
      {
        minimumQuantity: 1,
        includedSeats: 0,
        seatQuota: 25,
        billableMembershipRoles: ["member", "member"] as const,
      },
      {
        minimumQuantity: 1,
        includedSeats: 26,
        seatQuota: 25,
        billableMembershipRoles: ["member"] as const,
      },
      {
        minimumQuantity: 26,
        includedSeats: 0,
        seatQuota: 25,
        billableMembershipRoles: ["member"] as const,
      },
    ]) {
      await expect(registry.publishPlanVersion(createVersion({ quantityPolicy }))).rejects.toThrow(
        InvalidPlanVersionDefinitionProblem,
      );
    }
  });
});

describe("migrateSubscriptionPlanVersion", () => {
  it("pins a legacy subscription only to the explicit matching version", async () => {
    const registry = new InMemoryPlanRegistry();
    const version = createVersion();
    await registry.publishPlanVersion(version);

    await expect(
      migrateSubscriptionPlanVersion(createLegacySubscription(), version.ref, registry),
    ).resolves.toMatchObject({
      planId: "pro",
      planVersionRef: version.ref,
    });
  });

  it("does not silently select a version for unknown or mismatched references", async () => {
    const registry = new InMemoryPlanRegistry();
    const basicVersion = createVersion({
      ref: planVersionRef("basic@2026-01"),
      planId: "basic",
      providerBindings: [
        {
          provider: "polar",
          productId: "polar-basic-2026",
          priceIds: ["polar-basic-price-2026"],
        },
      ],
    });
    await registry.publishPlanVersion(basicVersion);

    await expect(
      migrateSubscriptionPlanVersion(
        createLegacySubscription(),
        planVersionRef("missing@2026-01"),
        registry,
      ),
    ).rejects.toBeInstanceOf(UnknownPlanVersionProblem);
    await expect(
      migrateSubscriptionPlanVersion(createLegacySubscription(), basicVersion.ref, registry),
    ).rejects.toBeInstanceOf(SubscriptionPlanVersionMismatchProblem);
  });

  it("exports the unknown provider mapping as a public Problem", () => {
    const problem = new UnknownProviderPlanMappingProblem("polar", "product", []);
    expect(problem.toJSON()).toMatchObject({
      code: "billing/unknown-provider-plan-mapping",
      status: 404,
    });
  });
});
