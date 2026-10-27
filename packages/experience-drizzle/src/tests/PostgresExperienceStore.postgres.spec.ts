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
function database(
  pool: Pool,
  beforeWork?: (client: Client) => Promise<void>,
): ExperiencePgDatabase {
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
        await beforeWork?.(client);
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

describe.skipIf(!url)("PostgreSQL experience configuration families", () => {
  it("evaluates published candidates beyond archived history and paginates every family", async () => {
    const require = createRequire(import.meta.url);
    const { Pool: PgPool } = require("pg") as {
      Pool: new (options: { connectionString: string; max?: number }) => Pool;
    };
    const pool = new PgPool({ connectionString: url as string, max: 2 });
    const store = new PostgresExperienceStore(database(pool));
    const scope = { appId: "history", environment: "test", tenantId: randomUUID() };
    const config: ExperienceConfig = {
      id: "z-published",
      placementId: "history.tip",
      scope,
      revision: 1,
      status: "published",
      renderer: "banner",
      content: { locale: "en", title: "Current", body: "Published content" },
      priority: 1,
    };
    await pool.query(
      readFileSync(new URL("../../migrations/0001_experience.up.sql", import.meta.url), "utf8"),
    );
    try {
      for (let index = 0; index < 100; index += 1) {
        await store.saveConfig({
          config: {
            ...config,
            id: `archived-${String(index).padStart(3, "0")}`,
            status: "archived",
          },
          expectedRevision: null,
          actorId: "operator",
          reason: "Archive",
          idempotencyKey: "initial",
        });
      }
      await store.saveConfig({
        config,
        expectedRevision: null,
        actorId: "operator",
        reason: "Publish",
        idempotencyKey: "initial",
      });
      const { evaluatePlacement } = await import("@croco/experience-core");
      const result = await evaluatePlacement({
        store,
        scope,
        placement: {
          id: config.placementId,
          allowedRenderers: ["banner"],
          schema: {
            contextFields: {},
            content: {
              locales: ["en"],
              maxTitleLength: 100,
              maxBodyLength: 1000,
              allowActionUrl: false,
            },
          },
        },
        subject: { kind: "customer", id: "reader" },
        context: {},
        locale: "en",
      });
      expect(result.reason).toBe("selected");
      expect(result.decision?.configId).toBe(config.id);
      const first = await store.listConfigs(scope, config.placementId, { limit: 100 });
      expect(first).toHaveLength(100);
      const second = await store.listConfigs(scope, config.placementId, {
        afterId: first.at(-1)?.id,
        limit: 100,
      });
      expect(second).toEqual([config]);
      expect(await store.listConfigs(scope, config.placementId, { afterId: config.id })).toEqual(
        [],
      );
      expect(await store.getConfig(scope, config.placementId, "archived-050")).toMatchObject({
        id: "archived-050",
        status: "archived",
      });
      expect(
        await store.getConfig({ ...scope, tenantId: "other" }, config.placementId, config.id),
      ).toBeUndefined();
      expect(await store.getConfig(scope, "other.placement", config.id)).toBeUndefined();
      const updated = { ...config, revision: 2, status: "archived" as const };
      await store.saveConfig({
        config: updated,
        expectedRevision: 1,
        actorId: "operator",
        reason: "Archive",
        idempotencyKey: "archive",
      });
      expect(await store.getConfig(scope, config.placementId, config.id)).toEqual(updated);
      expect(await store.listPublishedConfigs(scope, config.placementId)).toEqual([]);
    } finally {
      await pool.query(
        readFileSync(new URL("../../migrations/0001_experience.down.sql", import.meta.url), "utf8"),
      );
      await pool.end();
    }
  });

  it("serializes competing publications at the limit while preserving edits, retries and freed capacity", async () => {
    const require = createRequire(import.meta.url);
    const { Pool: PgPool } = require("pg") as {
      Pool: new (options: { connectionString: string; max?: number }) => Pool;
    };
    const pool = new PgPool({ connectionString: url as string, max: 2 });
    const store = new PostgresExperienceStore(database(pool));
    const scope = { appId: "limit", environment: "test", tenantId: randomUUID() };
    const base: ExperienceConfig = {
      id: "base",
      placementId: "limit.tip",
      scope,
      revision: 1,
      status: "published",
      renderer: "banner",
      content: { locale: "en", title: "Tip", body: "Content" },
      priority: 1,
    };
    const save = (
      config: ExperienceConfig,
      expectedRevision: number | null = null,
      idempotencyKey = "initial",
    ) =>
      store.saveConfig({
        config,
        expectedRevision,
        actorId: "operator",
        reason: "Test publication",
        idempotencyKey,
      });
    await pool.query(
      readFileSync(new URL("../../migrations/0001_experience.up.sql", import.meta.url), "utf8"),
    );
    try {
      for (let index = 0; index < 99; index += 1) await save({ ...base, id: `published-${index}` });
      const attempts = [
        { ...base, id: "contender-a" },
        { ...base, id: "contender-b" },
      ];
      const results = await Promise.allSettled(attempts.map((config) => save(config)));
      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      const rejection = results.find((result) => result.status === "rejected");
      expect(rejection?.status === "rejected" && rejection.reason.message).toContain(
        "configuration limit",
      );
      expect(await store.listPublishedConfigs(scope, base.placementId)).toHaveLength(100);
      const winner = attempts[results.findIndex((result) => result.status === "fulfilled")];
      const loser = attempts[results.findIndex((result) => result.status === "rejected")];
      if (!winner || !loser) throw new Error("Missing competing publication result");
      expect(await store.getConfig(scope, base.placementId, loser.id)).toBeUndefined();
      expect(await save(winner)).toEqual(winner);
      const edited = { ...winner, revision: 2, content: { ...winner.content, title: "Updated" } };
      await save(edited, 1, "edit");
      const draft = { ...loser, status: "draft" as const };
      await save(draft);
      await expect(
        save({ ...draft, revision: 2, status: "published" }, 1, "publish"),
      ).rejects.toThrow("configuration limit");
      await save({ ...edited, revision: 3, status: "archived" }, 2, "archive");
      const promoted = { ...draft, revision: 2, status: "published" as const };
      await save(promoted, 1, "publish");
      expect(await store.listPublishedConfigs(scope, base.placementId)).toHaveLength(100);
      expect(await store.getConfig(scope, base.placementId, loser.id)).toEqual(promoted);
    } finally {
      await pool.query(
        readFileSync(new URL("../../migrations/0001_experience.down.sql", import.meta.url), "utf8"),
      );
      await pool.end();
    }
  });
  it.each(["read uncommitted", "repeatable read", "serializable"] as const)(
    "preserves capacity when competing transactions retain %s snapshots",
    async (isolation) => {
      const require = createRequire(import.meta.url);
      const { Pool: PgPool } = require("pg") as {
        Pool: new (options: { connectionString: string; max?: number }) => Pool;
      };
      const pool = new PgPool({ connectionString: url as string, max: 2 });
      const store = new PostgresExperienceStore(database(pool));
      const scope = { appId: "isolation", environment: "test", tenantId: randomUUID() };
      const config: ExperienceConfig = {
        id: "base",
        placementId: "isolation.tip",
        scope,
        revision: 1,
        status: "published",
        renderer: "banner",
        content: { locale: "en", title: "Tip", body: "Content" },
        priority: 1,
      };
      const input = (id: string) => ({
        config: { ...config, id },
        expectedRevision: null,
        actorId: "operator",
        reason: "Publish",
        idempotencyKey: "initial",
      });
      await pool.query(
        readFileSync(new URL("../../migrations/0001_experience.up.sql", import.meta.url), "utf8"),
      );
      try {
        for (let index = 0; index < 99; index += 1)
          await store.saveConfig(input(`published-${index}`));
        let ready = (): void => {};
        const snapshotsReady = new Promise<void>((resolve) => {
          ready = resolve;
        });
        let snapshotCount = 0;
        const racing = new PostgresExperienceStore(
          database(pool, async (client) => {
            await client.query(`SET TRANSACTION ISOLATION LEVEL ${isolation}`);
            // Both snapshots see the same 99 families before either publication can start.
            const count = await client.query(
              "SELECT count(*)::integer AS count FROM croco_experience_current WHERE status = 'published'",
            );
            expect(count.rows[0]?.count).toBe(99);
            snapshotCount += 1;
            if (snapshotCount === 2) ready();
            await snapshotsReady;
          }),
        );
        const results = await Promise.allSettled([
          racing.saveConfig(input("contender-a")),
          racing.saveConfig(input("contender-b")),
        ]);
        if (isolation !== "read uncommitted") {
          expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(0);
          for (const result of results) {
            if (result.status === "rejected")
              expect(result.reason.message).toContain("read committed isolation");
          }
          expect(await store.listPublishedConfigs(scope, config.placementId)).toHaveLength(99);
          expect(await store.getConfig(scope, config.placementId, "contender-a")).toBeUndefined();
          expect(await store.getConfig(scope, config.placementId, "contender-b")).toBeUndefined();
          const snapshotStore = new PostgresExperienceStore(
            database(pool, async (client) => {
              await client.query(`SET TRANSACTION ISOLATION LEVEL ${isolation}`);
            }),
          );
          const original = input("published-0");
          expect(await snapshotStore.saveConfig(original)).toEqual(original.config);
          const edited = {
            ...original.config,
            revision: 2,
            content: { ...original.config.content, title: "Edited" },
          };
          await snapshotStore.saveConfig({
            ...original,
            config: edited,
            expectedRevision: 1,
            idempotencyKey: "edit",
          });
          await snapshotStore.saveConfig({
            ...original,
            config: { ...edited, revision: 3, status: "archived" },
            expectedRevision: 2,
            idempotencyKey: "archive",
          });
          expect(await store.listPublishedConfigs(scope, config.placementId)).toHaveLength(98);
        } else {
          expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
          expect(await store.listPublishedConfigs(scope, config.placementId)).toHaveLength(100);
          const failed = results.find((result) => result.status === "rejected");
          expect(failed?.status === "rejected" && failed.reason.message).toContain(
            "configuration limit",
          );
        }
      } finally {
        await pool.query(
          readFileSync(
            new URL("../../migrations/0001_experience.down.sql", import.meta.url),
            "utf8",
          ),
        );
        await pool.end();
      }
    },
  );
  it("rejects a stale serializable publication after a read-committed writer fills capacity", async () => {
    const require = createRequire(import.meta.url);
    const { Pool: PgPool } = require("pg") as {
      Pool: new (options: { connectionString: string; max?: number }) => Pool;
    };
    const pool = new PgPool({ connectionString: url as string, max: 2 });
    const store = new PostgresExperienceStore(database(pool));
    const scope = { appId: "mixed-isolation", environment: "test", tenantId: randomUUID() };
    const config: ExperienceConfig = {
      id: "base",
      placementId: "mixed.tip",
      scope,
      revision: 1,
      status: "published",
      renderer: "banner",
      content: { locale: "en", title: "Tip", body: "Content" },
      priority: 1,
    };
    const input = (id: string) => ({
      config: { ...config, id },
      expectedRevision: null,
      actorId: "operator",
      reason: "Publish",
      idempotencyKey: "initial",
    });
    await pool.query(
      readFileSync(new URL("../../migrations/0001_experience.up.sql", import.meta.url), "utf8"),
    );
    try {
      for (let index = 0; index < 99; index += 1)
        await store.saveConfig(input(`published-${index}`));
      const stale = new PostgresExperienceStore(
        database(pool, async (client) => {
          await client.query("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE");
          const snapshot = await client.query(
            "SELECT count(*)::integer AS count FROM croco_experience_current WHERE status = 'published'",
          );
          expect(snapshot.rows[0]?.count).toBe(99);
          // A different connection commits the last slot after this snapshot, before admission.
          await store.saveConfig(input("read-committed-winner"));
        }),
      );
      const result = await Promise.allSettled([stale.saveConfig(input("stale-contender"))]);
      const current = await pool.query(
        "SELECT count(*)::integer AS count FROM croco_experience_current WHERE status = 'published'",
      );
      expect(current.rows[0]?.count).toBe(100);
      expect(result[0]?.status).toBe("rejected");
      expect(await store.getConfig(scope, config.placementId, "stale-contender")).toBeUndefined();
      expect(await store.listPublishedConfigs(scope, config.placementId)).toHaveLength(100);
    } finally {
      await pool.query(
        readFileSync(new URL("../../migrations/0001_experience.down.sql", import.meta.url), "utf8"),
      );
      await pool.end();
    }
  });
});
