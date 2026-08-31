import { createEngagementStoreConformanceSuite } from "@croco/engagement-core";
import { TxManager } from "@croco/tx-core";
import { createDrizzleTxAdapter } from "@croco/tx-drizzle";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
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
