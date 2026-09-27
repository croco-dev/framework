import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { PostgresExperienceStore } from "../index";
import type { ExperiencePgDatabase, ExperiencePgExecutor } from "../index";
import type {
  ExperienceConfig,
  ExperienceReserveInput,
  ExperienceScope,
} from "@croco/experience-core";

const url = process.env.EXPERIENCE_TEST_DATABASE_URL;
const dialect = new PgDialect();

type Client = {
  query(text: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
};
type Pool = Client & {
  connect(): Promise<Client & { release(): void }>;
  end(): Promise<void>;
};
function database(pool: Pool): ExperiencePgDatabase {
  function executor(client: Client): ExperiencePgExecutor {
    return {
      execute: (statement) => {
        const query = dialect.sqlToQuery(statement);
        return client.query(query.sql, query.params);
      },
    };
  }
  return {
    ...executor(pool),
    transaction: async (work) => {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await work(executor(client));
        await client.query("COMMIT");
        return result;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
  };
}

describe.skipIf(!url)("PostgreSQL experience publication and receipts", () => {
  it("isolates concurrent quota reservations and preserves decisions through pause and restart", async () => {
    const require = createRequire(import.meta.url);
    const { Pool: PgPool } = require("pg") as {
      Pool: new (options: { connectionString: string; max?: number }) => Pool;
    };
    const poolA = new PgPool({ connectionString: url as string, max: 2 });
    const poolB = new PgPool({ connectionString: url as string, max: 2 });
    let poolAClosed = false;
    const migration = readFileSync(
      new URL("../../migrations/0001_experience.up.sql", import.meta.url),
      "utf8",
    );
    const down = readFileSync(
      new URL("../../migrations/0001_experience.down.sql", import.meta.url),
      "utf8",
    );
    await poolA.query(migration);
    const storeA = new PostgresExperienceStore(database(poolA));
    const storeB = new PostgresExperienceStore(database(poolB));
    const scope: ExperienceScope = { appId: "shop", environment: "test", tenantId: "tenant-a" };
    const otherScope: ExperienceScope = { ...scope, tenantId: "tenant-b" };
    const subject = { kind: "customer", id: "customer-1" };
    const config: ExperienceConfig = {
      id: "checkout-tip",
      placementId: "checkout.assurance",
      scope,
      revision: 1,
      status: "published",
      renderer: "banner",
      content: { locale: "en", title: "Safe checkout", body: "Your order is protected." },
      priority: 1,
      frequency: { maxDisplays: 1, windowSeconds: 3600 },
    };
    const at = new Date();
    function receipt(selectedConfig = config, selectedAt = at): ExperienceReserveInput {
      const decisionId = randomUUID();
      return {
        receipt: {
          decision: {
            decisionId,
            placementId: selectedConfig.placementId,
            configId: selectedConfig.id,
            policyVersion: 1,
            scope: selectedConfig.scope,
            subject,
            renderer: selectedConfig.renderer,
            content: selectedConfig.content,
            selectedAt: selectedAt.toISOString(),
            expiresAt: new Date(selectedAt.getTime() + 60000).toISOString(),
            reason: "matched",
          },
          handle: {
            decisionId,
            exposureId: randomUUID(),
            surfaceInstanceId: randomUUID(),
            token: randomUUID(),
          },
        },
        frequency: selectedConfig.frequency,
      };
    }
    try {
      await storeA.saveConfig({
        config,
        expectedRevision: null,
        actorId: "operator",
        reason: "Launch",
        idempotencyKey: "launch",
      });
      const shortWindow = {
        ...config,
        id: "short-window-tip",
        frequency: { maxDisplays: 1, windowSeconds: 5 },
      };
      await storeA.saveConfig({
        config: shortWindow,
        expectedRevision: null,
        actorId: "operator",
        reason: "Test pending reservation",
        idempotencyKey: "short-window",
      });
      const pending = receipt(shortWindow);
      expect(await storeA.reserve(pending)).toBe(true);
      expect(await storeB.reserve(receipt(shortWindow, new Date(at.getTime() + 6_000)))).toBe(
        false,
      );
      expect(
        await storeA.recordExposure({
          scope,
          subject,
          handle: pending.receipt.handle,
          at: new Date(at.getTime() + 7_000).toISOString(),
        }),
      ).toBe("recorded");
      const expiringConfig = { ...shortWindow, id: "expiring-confirm-tip" };
      await storeA.saveConfig({
        config: expiringConfig,
        expectedRevision: null,
        actorId: "operator",
        reason: "Test confirmation serialization",
        idempotencyKey: "expiring-confirm",
      });
      const expiringDraft = receipt(expiringConfig, new Date());
      const expiring: ExperienceReserveInput = {
        ...expiringDraft,
        receipt: {
          ...expiringDraft.receipt,
          decision: {
            ...expiringDraft.receipt.decision,
            expiresAt: new Date(
              Date.parse(expiringDraft.receipt.decision.selectedAt) + 1_000,
            ).toISOString(),
          },
        },
      };
      expect(await storeA.reserve(expiring)).toBe(true);
      const holder = await poolA.connect();
      try {
        await holder.query("BEGIN");
        await holder.query("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", [
          JSON.stringify([scope.appId, scope.environment, scope.tenantId]),
          JSON.stringify([expiringConfig.placementId, subject.kind, subject.id]),
        ]);
        const confirming = storeB.recordExposure({
          scope,
          subject,
          handle: expiring.receipt.handle,
          at: expiring.receipt.decision.selectedAt,
        });
        await new Promise((resolve) => setTimeout(resolve, 1_200));
        await holder.query("COMMIT");
        await expect(confirming).rejects.toThrow("expired before display");
      } finally {
        await holder.query("ROLLBACK");
        holder.release();
      }
      expect(await storeA.reserve(receipt(expiringConfig, new Date()))).toBe(true);
      const otherTenantConfig = { ...shortWindow, scope: otherScope };
      await storeB.saveConfig({
        config: otherTenantConfig,
        expectedRevision: null,
        actorId: "operator",
        reason: "Isolated tenant",
        idempotencyKey: "other-tenant",
      });
      expect(await storeB.reserve(receipt(otherTenantConfig))).toBe(true);
      const unconfirmedConfig = { ...shortWindow, id: "unconfirmed-tip" };
      await storeA.saveConfig({
        config: unconfirmedConfig,
        expectedRevision: null,
        actorId: "operator",
        reason: "Test expiry",
        idempotencyKey: "unconfirmed",
      });
      expect(await storeA.reserve(receipt(unconfirmedConfig))).toBe(true);
      expect(await storeB.reserve(receipt(unconfirmedConfig, new Date(at.getTime() + 6_000)))).toBe(
        false,
      );
      expect(
        await storeB.reserve(receipt(unconfirmedConfig, new Date(at.getTime() + 61_000))),
      ).toBe(true);
      expect(await storeB.listConfigs(otherScope, config.placementId)).toEqual([otherTenantConfig]);
      const first = receipt();
      const second = receipt();
      const admitted = await Promise.all([storeA.reserve(first), storeB.reserve(second)]);
      expect([...admitted].sort()).toEqual([false, true]);
      const winner = admitted[0] ? first : second;
      const losing = admitted[0] ? second : first;
      expect(await storeA.readDecision(scope, losing.receipt.decision.decisionId)).toBeUndefined();
      const handle = winner.receipt.handle;
      await expect(
        storeA.recordExposure({ scope: otherScope, subject, handle, at: at.toISOString() }),
      ).rejects.toThrow();
      await expect(
        storeA.recordExposure({
          scope,
          subject,
          handle: { ...handle, exposureId: randomUUID() },
          at: at.toISOString(),
        }),
      ).rejects.toThrow();
      expect(await storeA.recordExposure({ scope, subject, handle, at: at.toISOString() })).toBe(
        "recorded",
      );
      expect(await storeB.recordExposure({ scope, subject, handle, at: at.toISOString() })).toBe(
        "duplicate",
      );
      await storeB.dismiss({
        scope,
        subject,
        handle,
        at: new Date(at.getTime() + 61_000).toISOString(),
      });
      expect(await storeA.reserve(receipt())).toBe(false);
      const paused = { ...config, revision: 2, status: "paused" as const };
      await storeA.saveConfig({
        config: paused,
        expectedRevision: 1,
        actorId: "operator",
        reason: "Pause",
        idempotencyKey: "pause",
      });
      expect((await storeB.readDecision(scope, handle.decisionId))?.decision.content).toEqual(
        config.content,
      );
      expect((await storeB.listConfigs(scope, config.placementId))[0]?.status).toBe("paused");
      await poolA.end();
      poolAClosed = true;
      const restarted = new PgPool({ connectionString: url as string, max: 2 });
      try {
        const afterRestart = new PostgresExperienceStore(database(restarted));
        expect((await afterRestart.readDecision(scope, handle.decisionId))?.handle).toEqual(handle);
        expect((await afterRestart.listConfigs(scope, config.placementId))[0]?.revision).toBe(2);
        expect(await afterRestart.reserve(receipt())).toBe(false);
        expect(
          await afterRestart.reserve(receipt(shortWindow, new Date(at.getTime() + 8_000))),
        ).toBe(false);
      } finally {
        await restarted.end();
      }
    } finally {
      await poolB.query(down);
      await poolB.end();
      if (!poolAClosed) await poolA.end();
    }
  }, 30000);
});
