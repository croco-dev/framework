import * as assert from "node:assert/strict";

import type { TenantMappingStore } from "./ClerkTenantMapper";

export type TenantMappingStoreConformanceCase = {
  readonly name: string;
  run(): Promise<void>;
};

export type TenantMappingStoreConformanceOptions = {
  /** Creates two handles that share one backing mapping namespace. */
  readonly createStores: () =>
    | readonly [TenantMappingStore, TenantMappingStore]
    | Promise<readonly [TenantMappingStore, TenantMappingStore]>;
};

export type TenantMappingStoreConformanceSuite = {
  readonly cases: readonly TenantMappingStoreConformanceCase[];
};

export function createTenantMappingStoreConformanceSuite(
  options: TenantMappingStoreConformanceOptions,
): TenantMappingStoreConformanceSuite {
  return {
    cases: [
      {
        name: "creates an absent organization claim",
        run: async () => {
          const [store, observer] = await createStorePair(options);

          assert.deepEqual(await store.claim("conformance-org", "tenant-a"), {
            outcome: "created",
          });
          assert.equal(await store.get("conformance-org"), "tenant-a");
          assert.equal(await observer.get("conformance-org"), "tenant-a");
        },
      },
      {
        name: "treats a repeated tenant claim as idempotent",
        run: async () => {
          const [store, replayStore] = await createStorePair(options);
          await store.claim("conformance-org", "tenant-a");

          assert.deepEqual(await replayStore.claim("conformance-org", "tenant-a"), {
            outcome: "existing",
            tenantId: "tenant-a",
          });
          assert.equal(await store.get("conformance-org"), "tenant-a");
          assert.equal(await replayStore.get("conformance-org"), "tenant-a");
        },
      },
      {
        name: "keeps one authoritative tenant under conflicting concurrent claims",
        run: async () => {
          const [firstStore, secondStore] = await createStorePair(options);
          const claims = await Promise.all([
            firstStore.claim("conformance-org", "tenant-a"),
            secondStore.claim("conformance-org", "tenant-b"),
          ]);
          const created = claims.filter((claim) => claim.outcome === "created");
          const existing = claims.filter((claim) => claim.outcome === "existing");
          const firstTenantId = await firstStore.get("conformance-org");
          const secondTenantId = await secondStore.get("conformance-org");

          assert.equal(created.length, 1);
          assert.equal(existing.length, 1);
          assert.ok(firstTenantId === "tenant-a" || firstTenantId === "tenant-b");
          assert.equal(secondTenantId, firstTenantId);
          assert.equal(existing[0]?.tenantId, firstTenantId);
        },
      },
      {
        name: "keeps concurrent same-tenant claims idempotent",
        run: async () => {
          const [firstStore, secondStore] = await createStorePair(options);
          const claims = await Promise.all([
            firstStore.claim("conformance-org", "tenant-a"),
            secondStore.claim("conformance-org", "tenant-a"),
          ]);
          const existing = claims.find((claim) => claim.outcome === "existing");

          assert.deepEqual(claims.map((claim) => claim.outcome).sort(), ["created", "existing"]);
          assert.equal(existing?.tenantId, "tenant-a");
          assert.equal(await firstStore.get("conformance-org"), "tenant-a");
          assert.equal(await secondStore.get("conformance-org"), "tenant-a");
        },
      },
    ],
  };
}

async function createStorePair(
  options: TenantMappingStoreConformanceOptions,
): Promise<readonly [TenantMappingStore, TenantMappingStore]> {
  const stores = await options.createStores();
  assert.notEqual(
    stores[0],
    stores[1],
    "Tenant mapping conformance requires two distinct store handles",
  );
  return stores;
}
