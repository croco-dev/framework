import {
  AesGcmApiKeyRotationProtector,
  ApiKeyGenerator,
  ApiKeyHasher,
  ApiKeyManager,
  ApiKeyRotationConflictProblem,
} from "@croco/auth-core";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { DrizzleApiKeyStore } from "../libs/DrizzleApiKeyStore";
import { addApiKeyRotations } from "../migrations/addApiKeyRotations";
import { apiKeyRotations, apiKeys } from "../schema";

const connectionString = process.env.AUTH_POSTGRES_URL ?? "";

describe.skipIf(connectionString.length === 0)("DrizzleApiKeyStore PostgreSQL rotation", () => {
  let pool!: Pool;
  let store!: DrizzleApiKeyStore;
  let protector!: AesGcmApiKeyRotationProtector;

  beforeAll(async () => {
    pool = new Pool({ connectionString, max: 8 });
    await pool.query(`
        CREATE TABLE IF NOT EXISTS api_keys (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          prefix text NOT NULL,
          short_token text NOT NULL UNIQUE,
          hash text NOT NULL,
          permissions text[] NOT NULL DEFAULT '{}',
          name text NOT NULL,
          tenant_id text NOT NULL,
          created_by text NOT NULL,
          created_at timestamp NOT NULL DEFAULT now(),
          expires_at timestamp,
          revoked_at timestamp,
          last_used_at timestamp,
          rate_limit json,
          allowed_ips text[]
        )
      `);
    const db = drizzle(pool, { schema: { apiKeys, apiKeyRotations } });
    await addApiKeyRotations(db);
    store = new DrizzleApiKeyStore(
      db as unknown as ConstructorParameters<typeof DrizzleApiKeyStore>[0],
      { apiKeys, apiKeyRotations },
    );
    protector = new AesGcmApiKeyRotationProtector({
      activeKeyId: "test",
      keys: { test: new Uint8Array(32).fill(7) },
    });
  });

  beforeEach(async () => {
    await pool.query("DROP TRIGGER IF EXISTS reject_api_key_revoke ON api_keys");
    await pool.query("DROP FUNCTION IF EXISTS reject_api_key_revoke()");
    await pool.query("TRUNCATE TABLE api_key_rotations, api_keys");
  });

  afterAll(async () => {
    await pool.end();
  });

  function createManager(eventBus?: ConstructorParameters<typeof ApiKeyManager>[3]): ApiKeyManager {
    return new ApiKeyManager(
      store,
      new ApiKeyGenerator(),
      new ApiKeyHasher(),
      eventBus,
      undefined,
      protector,
    );
  }

  async function createOldKey(): Promise<{ id: string; key: string }> {
    return createManager().create({
      name: "Production key",
      tenantId: "tenant-1",
      permissions: ["orders:read"],
      prefix: "pk",
    });
  }

  it("rotates with the immediate foreign keys emitted by the exported schema", async () => {
    const constraints = await pool.query<{ condeferrable: boolean }>(`
      SELECT condeferrable
      FROM pg_constraint
      WHERE conrelid = 'api_key_rotations'::regclass
        AND contype = 'f'
      ORDER BY conname
    `);
    expect(constraints.rows).toEqual([{ condeferrable: false }, { condeferrable: false }]);

    const oldKey = await createOldKey();
    const rotated = await createManager().rotate(oldKey.id, {
      idempotencyKey: "immediate-foreign-keys",
    });

    expect(await store.findById(rotated.id)).toMatchObject({ id: rotated.id, revokedAt: null });
  });

  it("returns one replacement to concurrent retries of the same logical rotation", async () => {
    const oldKey = await createOldKey();
    const firstManager = createManager();
    const secondManager = createManager();

    const [first, second] = await Promise.all([
      firstManager.rotate(oldKey.id, { idempotencyKey: "same-rotation" }),
      secondManager.rotate(oldKey.id, { idempotencyKey: "same-rotation" }),
    ]);

    expect(second).toEqual(first);
    const state = await pool.query<{
      active_count: string;
      total_count: string;
      rotation_count: string;
    }>(`
        SELECT
          count(*) FILTER (WHERE revoked_at IS NULL)::text AS active_count,
          count(*)::text AS total_count,
          (SELECT count(*)::text FROM api_key_rotations) AS rotation_count
        FROM api_keys
      `);
    expect(state.rows[0]).toEqual({
      active_count: "1",
      total_count: "2",
      rotation_count: "1",
    });
  });

  it("allows only one of two competing logical rotations", async () => {
    const oldKey = await createOldKey();

    const results = await Promise.allSettled([
      createManager().rotate(oldKey.id, { idempotencyKey: "rotation-a" }),
      createManager().rotate(oldKey.id, { idempotencyKey: "rotation-b" }),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected");
    expect(rejected).toMatchObject({
      status: "rejected",
      reason: expect.any(ApiKeyRotationConflictProblem),
    });
    const active = await pool.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM api_keys WHERE revoked_at IS NULL",
    );
    expect(active.rows[0]?.count).toBe("1");
  });

  it("rolls back the replacement when a tenant idempotency key conflicts", async () => {
    const firstOldKey = await createOldKey();
    const secondOldKey = await createOldKey();

    const results = await Promise.allSettled([
      createManager().rotate(firstOldKey.id, { idempotencyKey: "shared-rotation" }),
      createManager().rotate(secondOldKey.id, { idempotencyKey: "shared-rotation" }),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    const state = await pool.query<{ active_count: string; total_count: string }>(`
      SELECT
        count(*) FILTER (WHERE revoked_at IS NULL)::text AS active_count,
        count(*)::text AS total_count
      FROM api_keys
    `);
    expect(state.rows[0]).toEqual({ active_count: "2", total_count: "3" });
  });

  it("rolls back the replacement and intent when revocation fails", async () => {
    const oldKey = await createOldKey();
    await pool.query(`
        CREATE FUNCTION reject_api_key_revoke() RETURNS trigger AS $$
        BEGIN
          IF OLD.revoked_at IS NULL AND NEW.revoked_at IS NOT NULL THEN
            RAISE EXCEPTION 'injected revoke failure';
          END IF;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql
      `);
    await pool.query(`
        CREATE TRIGGER reject_api_key_revoke
        BEFORE UPDATE ON api_keys
        FOR EACH ROW EXECUTE FUNCTION reject_api_key_revoke()
      `);

    await expect(
      createManager().rotate(oldKey.id, { idempotencyKey: "failed-rotation" }),
    ).rejects.toMatchObject({
      cause: expect.objectContaining({
        message: expect.stringContaining("injected revoke failure"),
      }),
    });

    const state = await pool.query<{
      active_count: string;
      total_count: string;
      rotation_count: string;
    }>(`
        SELECT
          count(*) FILTER (WHERE revoked_at IS NULL)::text AS active_count,
          count(*)::text AS total_count,
          (SELECT count(*)::text FROM api_key_rotations) AS rotation_count
        FROM api_keys
      `);
    expect(state.rows[0]).toEqual({
      active_count: "1",
      total_count: "1",
      rotation_count: "0",
    });
  });

  it("recovers post-commit event publication with the same event and credential", async () => {
    const oldKey = await createOldKey();
    const publishedEvents: Array<{ eventId: string; timestamp: Date }> = [];
    const observedStates: Array<{ old_revoked: boolean; new_active: boolean }> = [];
    const eventBus = {
      publish: vi.fn(async (event: { eventId: string; timestamp: Date }) => {
        const state = await pool.query<{ old_revoked: boolean; new_active: boolean }>(
          `
              SELECT
                EXISTS (
                  SELECT 1 FROM api_keys WHERE id = $1 AND revoked_at IS NOT NULL
                ) AS old_revoked,
                EXISTS (
                  SELECT 1 FROM api_keys
                  WHERE id = (SELECT new_key_id FROM api_key_rotations WHERE old_key_id = $1)
                    AND revoked_at IS NULL
                ) AS new_active
            `,
          [oldKey.id],
        );
        if (state.rows[0]) {
          observedStates.push(state.rows[0]);
        }
        publishedEvents.push({ eventId: event.eventId, timestamp: event.timestamp });
        if (publishedEvents.length === 1) {
          throw new Error("injected publication failure");
        }
      }),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
      clear: vi.fn(),
    } as unknown as NonNullable<ConstructorParameters<typeof ApiKeyManager>[3]>;
    const manager = createManager(eventBus);

    const first = await manager.rotate(oldKey.id, {
      idempotencyKey: "event-recovery",
    });
    const second = await manager.rotate(oldKey.id, {
      idempotencyKey: "event-recovery",
    });

    expect(first.degraded).toBe(true);
    expect(observedStates).toEqual([
      { old_revoked: true, new_active: true },
      { old_revoked: true, new_active: true },
    ]);
    expect(second.degraded).toBeUndefined();
    expect(second.key).toBe(first.key);
    expect(second.id).toBe(first.id);
    expect(publishedEvents[1]).toEqual(publishedEvents[0]);
    const intent = await pool.query<{
      recovery_ciphertext: string;
      event_status: string;
    }>("SELECT recovery_ciphertext, event_status FROM api_key_rotations WHERE old_key_id = $1", [
      oldKey.id,
    ]);
    expect(intent.rows[0]?.event_status).toBe("completed");
    expect(intent.rows[0]?.recovery_ciphertext).not.toContain(first.key);
    const parsed = new ApiKeyGenerator().parse(first.key);
    expect(intent.rows[0]?.recovery_ciphertext).not.toContain(parsed?.longToken);
  });

  it.each(["old", "replacement"] as const)(
    "purges recovery material when permanently deleting the %s key",
    async (target) => {
      const oldKey = await createOldKey();
      const rotated = await createManager().rotate(oldKey.id, {
        idempotencyKey: `delete-${target}`,
      });

      await store.delete(target === "old" ? oldKey.id : rotated.id);

      const state = await pool.query<{
        old_exists: boolean;
        replacement_exists: boolean;
        rotation_count: string;
      }>(
        `
          SELECT
            EXISTS (SELECT 1 FROM api_keys WHERE id = $1) AS old_exists,
            EXISTS (SELECT 1 FROM api_keys WHERE id = $2) AS replacement_exists,
            (SELECT count(*)::text FROM api_key_rotations) AS rotation_count
        `,
        [oldKey.id, rotated.id],
      );
      expect(state.rows[0]).toEqual({
        old_exists: target !== "old",
        replacement_exists: target !== "replacement",
        rotation_count: "0",
      });
    },
  );

  it("documents the unsafe legacy mixed-writer state that deployment must drain", async () => {
    const oldKey = await createOldKey();
    const old = await store.findById(oldKey.id);
    expect(old).not.toBeNull();
    if (!old) {
      return;
    }

    await store.save({
      prefix: old.prefix,
      shortToken: "legacyreplacement",
      hash: "legacy-hash",
      permissions: old.permissions,
      name: old.name,
      tenantId: old.tenantId,
      createdBy: old.createdBy,
      expiresAt: old.expiresAt,
      revokedAt: null,
      lastUsedAt: null,
      rateLimit: old.rateLimit,
      allowedIps: old.allowedIps,
    });
    await createManager().rotate(oldKey.id, { idempotencyKey: "atomic-writer" });
    await store.revoke(oldKey.id);

    const active = await pool.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM api_keys WHERE revoked_at IS NULL",
    );
    expect(active.rows[0]?.count).toBe("2");
  });
});
