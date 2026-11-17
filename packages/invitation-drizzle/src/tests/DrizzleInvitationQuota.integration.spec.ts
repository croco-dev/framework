import "reflect-metadata";
import { InvitationManager, RateLimitedInvitationService } from "@croco/invitation-core";
import { postgresResource } from "@croco/testing-resources";
import type { PostgresTestConnection } from "@croco/testing-resources";
import { TxManager } from "@croco/tx-core";
import type { TxAdapter } from "@croco/tx-core";
import { createDrizzleTxAdapter } from "@croco/tx-drizzle";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { DrizzleInvitationStore } from "../libs/DrizzleInvitationStore";
import type { DrizzleInvitationClient } from "../libs/DrizzleInvitationStore";
import { AesGcmInvitationTokenCipher } from "../libs/InvitationTokenCipher";
import { addEmailCreationIntents } from "../migrations/addEmailCreationIntents";

describe.skipIf(process.env.CROCO_TEST_REAL_RESOURCES !== "1")(
  "invitation quota on PostgreSQL",
  () => {
    let connection: PostgresTestConnection;
    let dispose: (() => void | Promise<void>) | undefined;
    const pools: Pool[] = [];

    beforeAll(async () => {
      const started = await postgresResource({ id: "invitation-quota", mode: "commit" }).start({
        register: () => undefined,
        testId: "invitation-quota",
        workerId: "invitation-drizzle",
      });
      connection = started.connection;
      dispose = started.dispose;
      await connection.query(`
      CREATE TABLE invitations (
        id text PRIMARY KEY,
        tenant_id text NOT NULL,
        inviter_id text NOT NULL,
        email text CHECK (email <> 'refused@example.com'),
        token_hash text NOT NULL UNIQUE,
        type text NOT NULL,
        role text NOT NULL,
        status text NOT NULL,
        expires_at timestamp NOT NULL,
        accepted_at timestamp,
        revoked_at timestamp,
        created_at timestamp NOT NULL DEFAULT now()
      );

      CREATE FUNCTION hold_first_invitation_insert() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        PERFORM pg_advisory_xact_lock(3761, 1);
        RETURN NEW;
      END;
      $$;

      CREATE TRIGGER hold_first_invitation_insert BEFORE INSERT ON invitations
        FOR EACH ROW WHEN (NEW.email = 'one@example.com')
        EXECUTE FUNCTION hold_first_invitation_insert()
    `);
      await addEmailCreationIntents(drizzle(connection.pool));
    }, 90_000);

    afterAll(async () => {
      try {
        await Promise.all(pools.map((pool) => pool.end()));
      } finally {
        await dispose?.();
      }
    }, 30_000);

    function worker(
      maxInvitesPerHour: number,
      maxInvitesPerDay: number,
      mode: "read-committed" | "repeatable-read" | "autocommit" = "read-committed",
      keyId = "test",
    ) {
      const pool = new Pool({ connectionString: connection.connectionString, max: 1 });
      pools.push(pool);
      const db = drizzle(pool);
      const adapter = createDrizzleTxAdapter(db) as unknown as TxAdapter<DrizzleInvitationClient>;
      const tx = new TxManager<DrizzleInvitationClient>({
        ...adapter,
        transaction(run, options, signal) {
          if (mode === "autocommit") {
            return run(db);
          }
          return adapter.transaction(
            run,
            mode === "repeatable-read" ? { isolationLevel: "repeatable read" } : options,
            signal,
          );
        },
      });
      const cipher = new AesGcmInvitationTokenCipher({
        activeKeyId: keyId,
        keys: { [keyId]: Buffer.alloc(32, 7) },
      });
      const store = new DrizzleInvitationStore(db, tx, cipher);
      const send = vi.fn();
      const publishNow = vi.fn();
      const manager = new InvitationManager(
        store,
        { addMember: vi.fn() } as never,
        { send } as never,
        { publishNow } as never,
        tx,
      );
      const service = new RateLimitedInvitationService(manager, store, {
        maxInvitesPerHour,
        maxInvitesPerDay,
      });
      return { manager, service, store, send, publishNow, pool, tx };
    }

    async function backendPid(pool: Pool): Promise<number> {
      const { rows } = await pool.query<{ pid: number }>("SELECT pg_backend_pid() AS pid");
      return rows[0].pid;
    }

    async function waitsForAdvisoryLock(pid: number): Promise<boolean> {
      const { rows } = await connection.query<{ waiting: boolean }>(
        "SELECT EXISTS (SELECT 1 FROM pg_locks WHERE pid = $1 AND locktype = 'advisory' AND NOT granted) AS waiting",
        [pid],
      );
      return rows[0].waiting;
    }

    it.each([
      { period: "hour", hourly: 1, daily: 10 },
      { period: "day", hourly: 10, daily: 1, batch: true },
    ])(
      "enforces the $period limit across independent connections",
      async ({ period, hourly, daily, batch }) => {
        const firstWorker = worker(hourly, daily);
        const secondWorker = worker(hourly, daily);
        const [firstPid, secondPid] = await Promise.all([
          backendPid(firstWorker.pool),
          backendPid(secondWorker.pool),
        ]);
        const tenantId = `tenant-${period}`;
        const firstInput = {
          idempotencyKey: batch ? "one:one@example.com" : "one",
          tenantId,
          inviterId: batch ? "system" : "inviter",
          email: "one@example.com",
          role: "member" as const,
        };
        const secondInput = { ...firstInput, idempotencyKey: "two", email: "two@example.com" };
        const blocker = await connection.pool.connect();
        const attempts: Promise<PromiseSettledResult<string>[]>[] = [];
        let results: PromiseSettledResult<string>[] = [];
        try {
          await blocker.query("BEGIN");
          await blocker.query("SELECT pg_advisory_xact_lock(3761, 1)");
          const firstAttempt = batch
            ? firstWorker.service
                .batchInvite(tenantId, [firstInput.email], { idempotencyKey: "one" })
                .then(({ successful, failed }) => {
                  expect(failed).toEqual([]);
                  return successful[0].token;
                })
            : firstWorker.service.createEmailInvitationWithRateLimit(firstInput);
          attempts.push(Promise.allSettled([firstAttempt]));
          // The insert trigger pauses the first transaction before its invitation is visible.
          await vi.waitFor(async () => expect(await waitsForAdvisoryLock(firstPid)).toBe(true), {
            timeout: 5_000,
          });

          let secondFinished = false;
          attempts.push(
            Promise.allSettled([
              batch
                ? secondWorker.service.createLinkInvitationWithRateLimit(secondInput)
                : secondWorker.service.createEmailInvitationWithRateLimit(secondInput),
            ]).then((settled) => {
              secondFinished = true;
              return settled;
            }),
          );
          await vi.waitFor(
            async () =>
              expect(secondFinished || (await waitsForAdvisoryLock(secondPid))).toBe(true),
            { timeout: 5_000 },
          );
        } finally {
          try {
            await blocker.query("ROLLBACK");
          } finally {
            blocker.release();
          }
          results = (await Promise.all(attempts)).flat();
        }

        const [first, second] = results;
        expect(first).toMatchObject({ status: "fulfilled", value: expect.any(String) });
        expect(second).toMatchObject({
          status: "rejected",
          reason: {
            code: "INVITATION_RATE_LIMIT_EXCEEDED",
            message: expect.stringContaining(period),
          },
        });
        if (first.status !== "fulfilled") throw first.reason;
        await expect(
          secondWorker.service.createEmailInvitationWithRateLimit(firstInput),
        ).resolves.toBe(first.value);
        await expect(
          secondWorker.service.createEmailInvitationWithRateLimit({
            ...firstInput,
            email: "different@example.com",
          }),
        ).rejects.toMatchObject({ code: "INVITATION_IDEMPOTENCY_CONFLICT" });
        const invitations = await secondWorker.store.findAllByTenant(tenantId);
        expect(invitations.map(({ email, status }) => ({ email, status }))).toEqual([
          { email: firstInput.email, status: "pending" },
        ]);
        expect(firstWorker.send).toHaveBeenCalledOnce();
        expect(secondWorker.send).not.toHaveBeenCalled();

        await expect(
          secondWorker.service.createEmailInvitationWithRateLimit({
            ...secondInput,
            tenantId: `${tenantId}-other`,
          }),
        ).resolves.toEqual(expect.any(String));
      },
      15_000,
    );

    it("uses the shared database clock for issuance and quota across workers", async () => {
      const slowWorker = worker(1, 10);
      const currentWorker = worker(1, 10);
      const input = {
        idempotencyKey: "slow-worker-invite",
        tenantId: "skewed-clocks",
        inviterId: "inviter",
        role: "member" as const,
        expiresInDays: 1,
      };
      const observedBefore = await connection.query<{ at: Date }>("SELECT clock_timestamp() AS at");
      vi.useFakeTimers({ toFake: ["Date"] });
      try {
        vi.setSystemTime(observedBefore.rows[0].at.getTime() - 61 * 60 * 1000);
        await expect(slowWorker.service.createLinkInvitationWithRateLimit(input)).resolves.toEqual(
          expect.any(String),
        );
      } finally {
        vi.useRealTimers();
      }

      await expect(
        currentWorker.service.createLinkInvitationWithRateLimit({
          ...input,
          idempotencyKey: "current-worker-invite",
        }),
      ).rejects.toMatchObject({ code: "INVITATION_RATE_LIMIT_EXCEEDED" });
      const [issued] = await currentWorker.store.findAllByTenant(input.tenantId);
      const expectedExpiry = new Date(issued.createdAt);
      expectedExpiry.setDate(expectedExpiry.getDate() + 1);
      expect(issued.expiresAt).toEqual(expectedExpiry);
      expect(issued.createdAt.getTime()).toBeGreaterThanOrEqual(
        observedBefore.rows[0].at.getTime(),
      );
    });

    it("preserves a live full-quota replay when another worker's clock is ahead", async () => {
      const writer = worker(1, 1);
      const fastWorker = worker(1, 1);
      const input = {
        idempotencyKey: "live-key",
        tenantId: "live-replay",
        inviterId: "inviter",
        role: "member" as const,
        expiresInDays: 1,
      };
      const token = await writer.service.createLinkInvitationWithRateLimit(input);
      const [invitation] = await writer.store.findAllByTenant(input.tenantId);
      vi.useFakeTimers({ toFake: ["Date"] });
      try {
        vi.setSystemTime(invitation.expiresAt.getTime() + 60_000);
        await expect(fastWorker.service.createLinkInvitationWithRateLimit(input)).resolves.toBe(
          token,
        );
        await expect(fastWorker.manager.createLinkInvitation(input)).resolves.toBe(token);
        await fastWorker.manager.createLinkInvitation({ ...input, tenantId: "ordinary-issuance" });
      } finally {
        vi.useRealTimers();
      }
      await expect(writer.service.createLinkInvitationWithRateLimit(input)).resolves.toBe(token);
      expect(await writer.store.findAllByTenant(input.tenantId)).toEqual([invitation]);
    });

    it("leaves other tenants' expired records alone during limited issuance", async () => {
      const { service, store } = worker(1, 1);
      const input = {
        idempotencyKey: "first",
        tenantId: "quota-denied",
        inviterId: "inviter",
        role: "member" as const,
      };
      await service.createLinkInvitationWithRateLimit(input);
      const [issued] = await store.findAllByTenant(input.tenantId);
      const other = await store.save({
        ...issued,
        id: "expired-other",
        tenantId: "expired-other",
        tokenHash: "expired-other",
        expiresAt: new Date(0),
      });

      await expect(
        service.createLinkInvitationWithRateLimit({ ...input, idempotencyKey: "second" }),
      ).rejects.toMatchObject({ code: "INVITATION_RATE_LIMIT_EXCEEDED" });
      expect(await store.findById(other.id)).toEqual(other);
      await service.createLinkInvitationWithRateLimit({ ...input, tenantId: "another-tenant" });
      expect(await store.findById(other.id)).toEqual(other);
    });

    it("uses database time for quota inspection and acceptance on a fast issuing worker", async () => {
      const { service, manager, store } = worker(1, 1);
      const tenantId = "fast-issuer";
      const observed = await connection.query<{ at: Date }>("SELECT clock_timestamp() AS at");
      vi.useFakeTimers({ toFake: ["Date"] });
      try {
        vi.setSystemTime(observed.rows[0].at.getTime() + 48 * 60 * 60 * 1000);
        const token = await service.createLinkInvitationWithRateLimit({
          idempotencyKey: "fast-issuance",
          tenantId,
          inviterId: "inviter",
          role: "member",
          expiresInDays: 1,
        });
        const outcomes = await Promise.allSettled([
          service.checkRateLimit(tenantId),
          manager.acceptInvitation({ token, userId: "recipient" }),
        ]);
        expect(outcomes).toMatchObject([
          { status: "rejected", reason: { code: "INVITATION_RATE_LIMIT_EXCEEDED" } },
          { status: "fulfilled", value: { status: "committed", value: { status: "accepted" } } },
        ]);
        await manager.createLinkInvitation({
          idempotencyKey: "ordinary-dated",
          tenantId: "ordinary-dated",
          inviterId: "inviter",
          role: "member",
          expiresInDays: 1,
        });
        const [ordinary] = await store.findAllByTenant("ordinary-dated");
        const after = await connection.query<{ at: Date }>("SELECT clock_timestamp() AS at");
        expect(ordinary.createdAt.getTime()).toBeLessThanOrEqual(after.rows[0].at.getTime());
      } finally {
        vi.useRealTimers();
      }
    });

    it("recovers a notification claim using database time despite worker clock differences", async () => {
      const fastWorker = worker(1, 1);
      const slowWorker = worker(1, 1);
      const input = {
        idempotencyKey: "held-notification",
        tenantId: "held-notification",
        inviterId: "inviter",
        email: "claim@example.com",
        role: "member" as const,
        expiresInDays: 1,
      };
      const observed = await connection.query<{ at: Date }>("SELECT clock_timestamp() AS at");
      const claim = fastWorker.store.claimEmailInvitationNotification.bind(fastWorker.store);
      vi.spyOn(fastWorker.store, "claimEmailInvitationNotification").mockImplementationOnce(
        async (...args) => {
          expect(await claim(...args)).toMatchObject({ notificationStatus: "processing" });
          throw new Error("worker disconnected");
        },
      );

      vi.useFakeTimers({ toFake: ["Date"] });
      try {
        vi.setSystemTime(observed.rows[0].at.getTime() + 48 * 60 * 60 * 1000);
        const [outcome] = await Promise.allSettled([
          fastWorker.service.createEmailInvitationWithRateLimit(input),
        ]);
        const stored = await slowWorker.store.findEmailInvitationCreation(
          input.tenantId,
          input.idempotencyKey,
        );
        expect(outcome).toMatchObject({
          status: "rejected",
          reason: {
            code: "INVITATION_CREATION_FAILED",
            extensions: {
              invitationId: stored?.invitation.id,
              phase: "notification",
              retrySafe: true,
            },
          },
        });
        const now = await connection.query<{ at: Date }>("SELECT clock_timestamp() AS at");
        expect(stored?.notificationClaimExpiresAt?.getTime()).toBeLessThanOrEqual(
          now.rows[0].at.getTime() + 5 * 60 * 1000,
        );
        await connection.query(
          `
          UPDATE invitation_email_creation_intents
          SET notification_claim_expires_at = (clock_timestamp() - interval '1 second') AT TIME ZONE 'UTC'
          WHERE tenant_id = $1 AND idempotency_key = $2
        `,
          [input.tenantId, input.idempotencyKey],
        );
        vi.setSystemTime(observed.rows[0].at.getTime() - 48 * 60 * 60 * 1000);
        await expect(slowWorker.service.createEmailInvitationWithRateLimit(input)).resolves.toBe(
          stored?.token,
        );
        expect(await slowWorker.store.findAllByTenant(input.tenantId)).toHaveLength(1);
        expect(slowWorker.send).toHaveBeenCalledOnce();
      } finally {
        vi.useRealTimers();
      }
    });

    it("reuses an expired creation key after its token encryption key is retired", async () => {
      const original = worker(1, 1);
      const rotated = worker(1, 1, "read-committed", "rotated");
      const input = {
        idempotencyKey: "retired-cipher",
        tenantId: "retired-cipher",
        inviterId: "inviter",
        role: "member" as const,
      };
      const first = await original.service.createLinkInvitationWithRateLimit(input);
      const [stored] = await original.store.findAllByTenant(input.tenantId);
      await connection.query(
        `
        UPDATE invitations
        SET created_at = (clock_timestamp() - interval '2 days') AT TIME ZONE 'UTC',
            expires_at = (clock_timestamp() - interval '1 day') AT TIME ZONE 'UTC'
        WHERE id = $1
      `,
        [stored.id],
      );
      const replacement = await rotated.service.createLinkInvitationWithRateLimit(input);
      expect(replacement).not.toBe(first);
      expect(await rotated.store.findById(stored.id)).toMatchObject({ status: "expired" });
      await expect(rotated.service.createLinkInvitationWithRateLimit(input)).resolves.toBe(
        replacement,
      );
    });

    it("does not report an ordinary resend with the original creation key as a replacement", async () => {
      const { manager, store } = worker(1, 1);
      const input = {
        idempotencyKey: "original-creation",
        tenantId: "ordinary-resend",
        inviterId: "inviter",
        role: "member" as const,
      };
      await manager.createLinkInvitation(input);
      const [invitation] = await store.findAllByTenant(input.tenantId);
      await expect(
        manager.resendInvitation(invitation.id, input.idempotencyKey),
      ).rejects.toMatchObject({
        code: "INVITATION_CREATION_FAILED",
      });
      expect(await store.findAllByTenant(input.tenantId)).toHaveLength(1);
    });

    it("reuses an ordinary creation key that expires after its transaction starts", async () => {
      const { manager, store, tx } = worker(1, 1);
      const input = {
        idempotencyKey: "ordinary-expired-key",
        tenantId: "ordinary-expired-key",
        inviterId: "inviter",
        role: "member" as const,
      };
      const first = await manager.createLinkInvitation(input);
      const [original] = await store.findAllByTenant(input.tenantId);

      const replacement = await tx.run(async () => {
        const expiresAt = new Date((await store.currentTime()).getTime() + 5);
        await connection.query("UPDATE invitations SET expires_at = $1 WHERE id = $2", [
          expiresAt.toISOString(),
          original.id,
        ]);
        await vi.waitFor(async () => {
          expect((await store.currentTime()).getTime()).toBeGreaterThan(expiresAt.getTime());
        });
        return manager.createLinkInvitation({ ...input, expiresInDays: 2 });
      });

      expect(replacement).not.toBe(first);
      expect(await store.findById(original.id)).toMatchObject({ status: "expired" });
      expect(
        await store.findEmailInvitationCreation(input.tenantId, input.idempotencyKey),
      ).toMatchObject({ token: replacement, invitation: { status: "pending" } });
    });

    it.each(["repeatable-read", "autocommit"] as const)(
      "refuses quota admission with a %s adapter",
      async (mode) => {
        const { service, store, publishNow } = worker(1, 1, mode);
        const input = {
          idempotencyKey: "invalid-transaction",
          tenantId: mode,
          inviterId: "inviter",
          role: "member" as const,
        };
        await expect(service.createLinkInvitationWithRateLimit(input)).rejects.toMatchObject({
          code: "INVITATION_RATE_LIMIT_UNAVAILABLE",
          reason: "read-committed-transaction-required",
        });
        expect(await store.findAllByTenant(input.tenantId)).toEqual([]);
        expect(publishNow).not.toHaveBeenCalled();
      },
    );

    it("requires rate-limited creation to own the root transaction", async () => {
      const { service, store, tx, publishNow } = worker(1, 1);
      const input = {
        idempotencyKey: "nested",
        tenantId: "nested",
        inviterId: "inviter",
        role: "member" as const,
      };
      await expect(
        tx.run(() => service.batchInvite(input.tenantId, ["nested@example.com"])),
      ).resolves.toEqual({
        successful: [],
        failed: [
          { email: "nested@example.com", error: "Invitation issuance quota is unavailable" },
        ],
      });
      await expect(
        tx.run(() => service.createLinkInvitationWithRateLimit(input)),
      ).rejects.toMatchObject({
        code: "INVITATION_RATE_LIMIT_UNAVAILABLE",
      });
      expect(await store.findAllByTenant(input.tenantId)).toEqual([]);
      expect(publishNow).not.toHaveBeenCalled();
    });

    it("rolls back the creation intent on an insert failure and leaves the quota available", async () => {
      const { service, store, send, publishNow } = worker(1, 1);
      const input = {
        idempotencyKey: "recoverable",
        tenantId: "rollback",
        inviterId: "inviter",
        role: "member" as const,
      };
      await expect(
        service.createEmailInvitationWithRateLimit({ ...input, email: "refused@example.com" }),
      ).rejects.toMatchObject({ code: "INVITATION_CREATION_FAILED" });
      expect(
        await store.findEmailInvitationCreation(input.tenantId, input.idempotencyKey),
      ).toBeNull();
      expect(await store.findAllByTenant(input.tenantId)).toEqual([]);
      expect(send).not.toHaveBeenCalled();
      expect(publishNow).not.toHaveBeenCalled();

      await expect(
        service.createEmailInvitationWithRateLimit({ ...input, email: "allowed@example.com" }),
      ).resolves.toEqual(expect.any(String));
      expect(await store.countIssuedByTenant(input.tenantId, new Date(0))).toBe(1);
    });
  },
);
