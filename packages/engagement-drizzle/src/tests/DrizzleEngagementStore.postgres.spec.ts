import {
  createEngagementStoreConformanceSuite,
  PushEndpointLifecycle,
} from "@croco/engagement-core";
import { TxManager } from "@croco/tx-core";
import { createDrizzleTxAdapter } from "@croco/tx-drizzle";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  createEngagementSchema,
  type DrizzleEngagementTxManager,
  DrizzleEngagementStore,
  dropEngagementSchema,
  engagementContactEndpoints,
  engagementDeliveryEvents,
  engagementDispatchTargets,
  engagementDispatches,
  engagementPreferences,
  engagementSuppressions,
} from "../index";

const connectionString = process.env.ENGAGEMENT_POSTGRES_URL ?? "";
const describePostgres = connectionString.length === 0 ? describe.skip : describe;
type DrizzleEngagementTransaction = NonNullable<
  ReturnType<DrizzleEngagementTxManager["getClient"]>
>;

const schema = {
  engagementContactEndpoints,
  engagementDeliveryEvents,
  engagementDispatchTargets,
  engagementDispatches,
  engagementPreferences,
  engagementSuppressions,
};

describePostgres("DrizzleEngagementStore PostgreSQL conformance", () => {
  const pool = new Pool({ connectionString, max: 8 });
  const db = drizzle(pool, { schema });
  const txManager = new TxManager(
    createDrizzleTxAdapter(db as unknown as Parameters<typeof createDrizzleTxAdapter>[0]),
  ) as unknown as TxManager<DrizzleEngagementTransaction>;

  beforeAll(async () => {
    await dropEngagementSchema(db);
    await createEngagementSchema(db);
  });

  afterAll(async () => {
    await dropEngagementSchema(db);
    await pool.end();
  });

  async function reset(): Promise<void> {
    await db.execute(sql`
      truncate table
        engagement_delivery_events,
        engagement_dispatch_targets,
        engagement_dispatches,
        engagement_suppressions,
        engagement_preferences,
        engagement_contact_endpoints
    `);
  }

  const suite = createEngagementStoreConformanceSuite({
    createStore: () => new DrizzleEngagementStore(db, txManager),
    reopenStore: () => new DrizzleEngagementStore(db, txManager),
  });

  for (const testCase of suite.cases) {
    // oxlint-disable-next-line jest/valid-title -- exported conformance cases own stable names
    it(testCase.name, async () => {
      await reset();
      await testCase.run();
    });
  }

  it("keeps the newest lastSeenAt when an overlapping refresh reads stale state", async () => {
    await reset();
    const store = new DrizzleEngagementStore(db, txManager);
    const input = {
      id: "endpoint-concurrent",
      tenantId: "tenant-concurrent",
      recipientId: "recipient-concurrent",
      kind: "push" as const,
      provider: "fcm",
      app: "app",
      platform: "android",
      environment: "test",
      tokenReference: "vault:token",
      lastSeenAt: new Date("2026-01-01T00:00:00.000Z"),
    };
    const initial = await store.saveEndpoint(input);
    const newerAt = new Date("2026-01-03T00:00:00.000Z");
    const olderAt = new Date("2026-01-02T00:00:00.000Z");
    let releaseRead: () => void = () => {};
    const staleRead = new Promise<void>((resolve) => {
      releaseRead = resolve;
    });
    let releaseWrite: () => void = () => {};
    const newerCommitted = new Promise<void>((resolve) => {
      releaseWrite = resolve;
    });

    const older = store.transaction(async (stores) => {
      const observed = await stores.getEndpoint(input.tenantId, input.id);
      releaseRead();
      await newerCommitted;
      expect(observed?.lastSeenAt).toEqual(input.lastSeenAt);
      return stores.saveEndpoint({ ...input, lastSeenAt: olderAt });
    });
    await staleRead;
    try {
      await store.transaction((stores) => stores.saveEndpoint({ ...input, lastSeenAt: newerAt }));
    } finally {
      releaseWrite();
    }
    const refreshed = await older;

    expect(refreshed.lastSeenAt).toEqual(newerAt);
    expect(refreshed.version).toBe(initial.version);
    await expect(store.getEndpoint(input.tenantId, input.id)).resolves.toMatchObject({
      lastSeenAt: newerAt,
      version: initial.version,
    });
  });

  it("keeps a device refreshed after stale maintenance reads it active at READ COMMITTED", async () => {
    await reset();
    const store = new DrizzleEngagementStore(db, txManager);
    const lifecycle = new PushEndpointLifecycle(store);
    const scope = {
      tenantId: "tenant-stale-race",
      recipientId: "recipient-stale-race",
      provider: "fcm",
      app: "app",
      platform: "android",
      environment: "test",
    };
    const registration = {
      ...scope,
      tokenReference: "vault:stale-race",
      lastSeenAt: new Date("2026-01-01T00:00:00.000Z"),
    };
    const initial = await lifecycle.register(registration);
    const cutoff = new Date("2026-02-01T00:00:00.000Z");
    let releaseRead: () => void = () => {};
    const staleRead = new Promise<void>((resolve) => {
      releaseRead = resolve;
    });
    let releaseInvalidation: () => void = () => {};
    const refreshedCommitted = new Promise<void>((resolve) => {
      releaseInvalidation = resolve;
    });
    const list = store.listActiveEndpoints.bind(store);
    vi.spyOn(store, "listActiveEndpoints").mockImplementationOnce(async (...args) => {
      const isolation = await txManager.getClient()?.execute(sql`show transaction_isolation`);
      expect(isolation?.rows[0]).toMatchObject({ transaction_isolation: "read committed" });
      const endpoints = await list(...args);
      releaseRead();
      await refreshedCommitted;
      return endpoints;
    });
    const maintenance = lifecycle.invalidateStale({
      ...scope,
      lastSeenBefore: cutoff,
      invalidatedAt: cutoff,
    });
    await staleRead;
    try {
      const refreshed = await lifecycle.register({ ...registration, lastSeenAt: cutoff });
      expect(refreshed.endpoint.version).toBe(initial.endpoint.version);
    } finally {
      releaseInvalidation();
    }
    await expect(maintenance).resolves.toMatchObject([{ status: "freshness-mismatch" }]);
    await expect(
      store.listActiveEndpoints(scope.tenantId, scope.recipientId),
    ).resolves.toMatchObject([
      { id: initial.endpoint.id, lastSeenAt: cutoff, version: initial.endpoint.version },
    ]);
  });

  it.each(["register", "refresh", "rotate"] as const)(
    "rejects %s when terminal invalidation commits after the active endpoint read",
    async (operation) => {
      await reset();
      const store = new DrizzleEngagementStore(db, txManager);
      const lifecycle = new PushEndpointLifecycle(store);
      const registration = {
        tenantId: "tenant-invalidation-race",
        recipientId: "recipient-invalidation-race",
        provider: "fcm",
        app: "app",
        platform: "android",
        environment: "test",
        tokenReference: "vault:predecessor",
        lastSeenAt: new Date("2026-01-01"),
      };
      const first = await lifecycle.register(registration);
      const replacementInput = { ...registration, tokenReference: "vault:replacement" };
      const target = operation === "rotate" ? await lifecycle.register(replacementInput) : first;
      let releaseRead: () => void = () => {};
      const activeRead = new Promise<void>((resolve) => {
        releaseRead = resolve;
      });
      let releaseSave: () => void = () => {};
      const invalidationCommitted = new Promise<void>((resolve) => {
        releaseSave = resolve;
      });
      const getEndpoint = store.getEndpoint.bind(store);
      const spy = vi.spyOn(store, "getEndpoint").mockImplementation(async (...args) => {
        const endpoint = await getEndpoint(...args);
        if (args[1] === target.endpoint.id) {
          releaseRead();
          await invalidationCommitted;
        }
        return endpoint;
      });
      const result =
        operation === "register"
          ? lifecycle.register(registration)
          : lifecycle.rotate({
              ...(operation === "rotate" ? replacementInput : registration),
              previousEndpointId: first.endpoint.id,
              expectedVersion: first.endpoint.version,
            });
      const rejection = expect(result).rejects.toThrow(
        "Push endpoint was invalidated during registration",
      );
      await activeRead;
      try {
        await expect(
          store.invalidateEndpoint({
            tenantId: registration.tenantId,
            endpointId: target.endpoint.id,
            expectedVersion: target.endpoint.version,
            reason: "token-invalid",
            invalidatedAt: new Date("2026-02-01"),
          }),
        ).resolves.toMatchObject({ status: "invalidated" });
      } finally {
        releaseSave();
        spy.mockRestore();
      }
      await rejection;
      await expect(
        store.getEndpoint(registration.tenantId, target.endpoint.id),
      ).resolves.toMatchObject({
        invalidationReason: "token-invalid",
      });
      const active = await store.listActiveEndpoints(
        registration.tenantId,
        registration.recipientId,
      );
      expect(active).toEqual(operation === "rotate" ? [first.endpoint] : []);
    },
  );

  it("serializes concurrent writes to one logical dispatch identity", async () => {
    await reset();
    const store = new DrizzleEngagementStore(db, txManager);
    const input = {
      tenantId: "tenant-concurrent",
      messageId: "message-concurrent",
      recipientId: "recipient-concurrent",
      channel: "email" as const,
      semanticKey: "semantic-concurrent",
      topic: "system.receipt",
      targets: [],
      outcome: { kind: "unavailable" as const, reason: "no-endpoint" as const },
      recordedAt: new Date("2026-01-01T00:00:00.000Z"),
    };

    const [first, second] = await Promise.all([
      store.recordDispatch(input),
      store.recordDispatch({
        ...input,
        outcome: { kind: "suppressed", reason: "preference" },
      }),
    ]);

    expect(second.id).toBe(first.id);
    expect(second.outcome).toEqual(first.outcome);
    await expect(
      store.listByRecipient("tenant-concurrent", "recipient-concurrent", { limit: 10 }),
    ).resolves.toMatchObject({ items: [{ id: first.id }] });
  });
});
