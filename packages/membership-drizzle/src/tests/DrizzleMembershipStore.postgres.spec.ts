import "reflect-metadata";
import {
  AlreadyMemberProblem,
  createMembershipStoreConformanceSuite,
  LastOwnerProblem,
  LastOwnerCannotBeRemovedProblem,
  MembershipConstraintProblem,
  MembershipService,
  SeatLimitExceededProblem,
  type MembershipOwnerMutationInput,
} from "@croco/membership-core";
import { TxManager } from "@croco/tx-core";
import { createDrizzleTxAdapter } from "@croco/tx-drizzle";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  type DrizzleMembershipClient,
  DrizzleMembershipStore,
} from "../libs/DrizzleMembershipStore";
import { addMembershipEventIntents } from "../migrations/membershipEventIntents";
import { addMembershipSeatOrdinals } from "../migrations/addMembershipSeatOrdinals";

import { setMembershipTimestampDefaults } from "../index";

const connectionString = process.env.MEMBERSHIP_POSTGRES_URL ?? "";

class TestDrizzleMembershipStore extends DrizzleMembershipStore {
  mutateOwnerPrimitive(input: MembershipOwnerMutationInput) {
    return this.mutateOwner(input);
  }
}

describe.skipIf(connectionString.length === 0)(
  "DrizzleMembershipStore PostgreSQL concurrency",
  () => {
    let pool!: Pool;
    let service!: MembershipService;
    let store!: TestDrizzleMembershipStore;
    let txManager!: TxManager<DrizzleMembershipClient>;

    beforeAll(async () => {
      pool = new Pool({ connectionString, max: 4 });
      const db = drizzle(pool);
      const client = db as unknown as DrizzleMembershipClient;
      txManager = new TxManager(createDrizzleTxAdapter(client));
      store = new TestDrizzleMembershipStore(client, txManager);
      service = new MembershipService({
        store,
        eventPublisher: { publishIdempotently: async () => undefined },
      });

      await pool.query(`
      create table if not exists memberships (
        id text primary key,
        tenant_id text not null,
        user_id text not null,
        role text not null,
        created_at timestamp not null default now(),
        updated_at timestamp not null default now(),
        unique (tenant_id, user_id)
      )
      `);
      await addMembershipSeatOrdinals({ execute: (query) => db.execute(query) });
      await setMembershipTimestampDefaults({ execute: (query) => db.execute(query) });
      await addMembershipEventIntents({ execute: (query) => db.execute(query) });
    });

    beforeEach(async () => {
      await pool.query(
        "truncate table membership_event_intents, membership_idempotency_records, memberships",
      );
      await pool.query(
        `insert into memberships (id, tenant_id, user_id, role)
         values ('membership-a', 'tenant-1', 'owner-a', 'owner'),
                ('membership-b', 'tenant-1', 'owner-b', 'owner')`,
      );
    });

    afterAll(async () => {
      await pool.end();
    });

    it("rejects sole-owner demotion without recording a command or event intent", async () => {
      await pool.query(
        "insert into memberships (id, tenant_id, user_id, role) values ($1, $2, $3, $4)",
        ["membership-sole-demotion", "tenant-sole-demotion", "owner", "owner"],
      );

      await expect(
        service.updateRole("tenant-sole-demotion", "owner", "admin", "demote:sole-owner"),
      ).rejects.toBeInstanceOf(LastOwnerProblem);
      await expect(
        store.findByTenantAndUser("tenant-sole-demotion", "owner"),
      ).resolves.toMatchObject({ role: "owner" });
      await expect(store.hasExecutedCommand("demote:sole-owner")).resolves.toBe(false);
      await expect(store.getPendingEventIntent("demote:sole-owner")).resolves.toBeNull();
    });

    it("rejects sole-owner removal without recording a command or event intent", async () => {
      await pool.query(
        "insert into memberships (id, tenant_id, user_id, role) values ($1, $2, $3, $4)",
        ["membership-sole-removal", "tenant-sole-removal", "owner", "owner"],
      );

      await expect(
        service.removeMember("tenant-sole-removal", "owner", "remove:sole-owner"),
      ).rejects.toBeInstanceOf(LastOwnerCannotBeRemovedProblem);
      await expect(
        store.findByTenantAndUser("tenant-sole-removal", "owner"),
      ).resolves.toMatchObject({ role: "owner" });
      await expect(store.hasExecutedCommand("remove:sole-owner")).resolves.toBe(false);
      await expect(store.getPendingEventIntent("remove:sole-owner")).resolves.toBeNull();
    });

    it("replays a successful owner removal with one recoverable event intent", async () => {
      const command = {
        operation: "remove" as const,
        idempotencyKey: "remove:owner-a",
        tenantId: "tenant-1",
        userId: "owner-a",
      };

      await expect(store.execute(command)).resolves.toMatchObject({
        operation: "remove",
        replayed: false,
      });
      await expect(store.execute(command)).resolves.toMatchObject({
        operation: "remove",
        replayed: true,
      });
      await expect(store.findByTenantAndUser("tenant-1", "owner-a")).resolves.toBeNull();
      await expect(store.countByRole("tenant-1", "owner")).resolves.toBe(1);
      await expect(store.getPendingEventIntent(command.idempotencyKey)).resolves.toMatchObject({
        events: [{ eventName: "membership.removed" }],
      });
    });

    it("replays a successful owner demotion with one recoverable event intent", async () => {
      const command = {
        operation: "update_role" as const,
        idempotencyKey: "demote:owner-a",
        tenantId: "tenant-1",
        userId: "owner-a",
        role: "admin" as const,
      };

      await expect(store.execute(command)).resolves.toMatchObject({
        operation: "update_role",
        membership: { role: "admin" },
        replayed: false,
      });
      await expect(store.execute(command)).resolves.toMatchObject({
        operation: "update_role",
        membership: { role: "admin" },
        replayed: true,
      });
      await expect(store.countByRole("tenant-1", "owner")).resolves.toBe(1);
      await expect(store.getPendingEventIntent(command.idempotencyKey)).resolves.toMatchObject({
        events: [{ eventName: "membership.updated" }],
      });
    });

    it.each([
      { isolationLevel: "read committed" as const, losingStatus: "last_owner" as const },
      { isolationLevel: "repeatable read" as const, losingStatus: "conflict" as const },
      { isolationLevel: "serializable" as const, losingStatus: "conflict" as const },
    ])(
      "preserves one owner across two $isolationLevel removal transactions",
      async ({ isolationLevel, losingStatus }) => {
        let arrivals = 0;
        let release!: () => void;
        const barrier = new Promise<void>((resolve) => {
          release = resolve;
        });
        const mutate = async (userId: string) => {
          return txManager.run(
            async () => {
              arrivals += 1;
              if (arrivals === 2) {
                release();
              }
              await barrier;
              return store.mutateOwnerPrimitive({
                tenantId: "tenant-1",
                userId,
                operation: "remove",
              });
            },
            { options: { isolationLevel } },
          );
        };

        const results = await Promise.all([mutate("owner-a"), mutate("owner-b")]);

        expect(results.map((result) => result.status).sort()).toEqual(
          ["applied", losingStatus].sort(),
        );
        await expect(store.countByRole("tenant-1", "owner")).resolves.toBe(1);
      },
    );

    it.each(["read committed", "repeatable read", "serializable"] as const)(
      "replays a concurrent same-key retry after $isolationLevel settles",
      async (isolationLevel) => {
        await pool.query(
          "truncate table membership_event_intents, membership_idempotency_records, memberships",
        );
        let arrivals = 0;
        let release!: () => void;
        const barrier = new Promise<void>((resolve) => {
          release = resolve;
        });
        const add = async () => {
          return txManager.run(
            async () => {
              arrivals += 1;
              if (arrivals === 2) release();
              await barrier;
              return service.addMember("tenant-1", "user-1", "member", "add:user-1");
            },
            { options: { isolationLevel } },
          );
        };

        const concurrent = await Promise.allSettled([add(), add()]);
        const original = concurrent.find(
          (result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof add>>> =>
            result.status === "fulfilled",
        );
        expect(original).toBeDefined();
        if (isolationLevel === "read committed") {
          expect(concurrent.filter((result) => result.status === "fulfilled")).toHaveLength(2);
        } else {
          expect(concurrent.find((result) => result.status === "rejected")).toMatchObject({
            status: "rejected",
            reason: expect.any(MembershipConstraintProblem),
          });
        }

        const replay = await service.addMember("tenant-1", "user-1", "member", "add:user-1");
        expect(replay.id).toBe(original?.value.id);
        await expect(store.countAll("tenant-1")).resolves.toBe(1);
        await expect(store.listPendingEventIntents()).resolves.toHaveLength(1);
      },
    );

    it("blocks additions after a quota downgrade leaves only high ordinal claims", async () => {
      await pool.query(
        "truncate table membership_event_intents, membership_idempotency_records, memberships",
      );
      for (let index = 1; index <= 6; index += 1) {
        await store.execute({
          operation: "add",
          idempotencyKey: `add:user-${index}`,
          membershipId: `membership-${index}`,
          tenantId: "tenant-1",
          userId: `user-${index}`,
          role: "member",
          maxSeats: 10,
        });
      }
      for (let index = 1; index <= 4; index += 1) {
        await pool.query("delete from memberships where tenant_id = $1 and user_id = $2", [
          "tenant-1",
          `user-${index}`,
        ]);
      }

      await expect(
        store.execute({
          operation: "add",
          idempotencyKey: "add:user-7",
          membershipId: "membership-7",
          tenantId: "tenant-1",
          userId: "user-7",
          role: "member",
          maxSeats: 2,
        }),
      ).rejects.toBeInstanceOf(SeatLimitExceededProblem);
      await expect(store.countAll("tenant-1")).resolves.toBe(2);
      await expect(store.hasExecutedCommand("add:user-7")).resolves.toBe(false);
    });

    it.each([
      { isolationLevel: "read committed" as const, problem: AlreadyMemberProblem },
      { isolationLevel: "repeatable read" as const, problem: AlreadyMemberProblem },
      { isolationLevel: "serializable" as const, problem: AlreadyMemberProblem },
    ])(
      "prevents unlimited same-user duplicates under $isolationLevel",
      async ({ isolationLevel, problem }) => {
        await pool.query(
          "truncate table membership_event_intents, membership_idempotency_records, memberships",
        );
        let arrivals = 0;
        let release!: () => void;
        const barrier = new Promise<void>((resolve) => {
          release = resolve;
        });
        const add = async (idempotencyKey: string) => {
          return txManager.run(
            async () => {
              arrivals += 1;
              if (arrivals === 2) release();
              await barrier;
              return service.addMember("tenant-1", "user-1", "member", idempotencyKey);
            },
            { options: { isolationLevel } },
          );
        };

        const results = await Promise.allSettled([add("add:user-1:a"), add("add:user-1:b")]);

        expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
        expect(results.find((result) => result.status === "rejected")).toMatchObject({
          status: "rejected",
          reason: expect.any(problem),
        });
        await expect(store.countAll("tenant-1")).resolves.toBe(1);
        await expect(store.listPendingEventIntents()).resolves.toHaveLength(1);
      },
    );

    it("rolls back membership and idempotency when event intent insertion fails", async () => {
      await pool.query("drop table membership_event_intents");

      await expect(
        store.execute({
          operation: "add",
          idempotencyKey: "rollback-add",
          membershipId: "rollback-membership",
          tenantId: "tenant-rollback",
          userId: "user-rollback",
          role: "member",
          maxSeats: null,
        }),
      ).rejects.toThrow();
      await expect(
        store.findByTenantAndUser("tenant-rollback", "user-rollback"),
      ).resolves.toBeNull();
      await expect(store.hasExecutedCommand("rollback-add")).resolves.toBe(false);

      const db = drizzle(pool);
      await addMembershipEventIntents({ execute: (query) => db.execute(query) });
    });

    it("satisfies the shared membership command conformance contract", async () => {
      const suite = createMembershipStoreConformanceSuite({
        createStore: async () => {
          await pool.query(
            "truncate table membership_event_intents, membership_idempotency_records, memberships",
          );
          return store;
        },
      });
      for (const testCase of suite.cases) await testCase.run();
    });

    it("applies the same invariant to repeatable-read demotions", async () => {
      let arrivals = 0;
      let release!: () => void;
      const barrier = new Promise<void>((resolve) => {
        release = resolve;
      });
      const demote = async (userId: string) => {
        return txManager.run(
          async () => {
            arrivals += 1;
            if (arrivals === 2) {
              release();
            }
            await barrier;
            return store.mutateOwnerPrimitive({
              tenantId: "tenant-1",
              userId,
              operation: "demote",
              role: "admin",
            });
          },
          { options: { isolationLevel: "repeatable read" } },
        );
      };

      const results = await Promise.all([demote("owner-a"), demote("owner-b")]);

      expect(results.map((result) => result.status).sort()).toEqual(["applied", "conflict"]);
      await expect(store.countByRole("tenant-1", "owner")).resolves.toBe(1);
    });

    it.each([
      { isolationLevel: "read committed" as const, problem: SeatLimitExceededProblem },
      { isolationLevel: "repeatable read" as const, problem: SeatLimitExceededProblem },
      { isolationLevel: "serializable" as const, problem: SeatLimitExceededProblem },
    ])(
      "allows exactly one concurrent creation for the final seat under $isolationLevel",
      async ({ isolationLevel, problem }) => {
        await pool.query(
          "truncate table membership_event_intents, membership_idempotency_records, memberships",
        );
        const limitedService = new MembershipService({
          store,
          eventPublisher: { publishIdempotently: async () => undefined },
          seatLimitChecker: {
            checkSeatAvailability: async () => ({
              usage: 0,
              quota: 1,
              exceeded: false,
              remaining: 1,
            }),
            getCurrentMemberCount: async () => store.countAll("tenant-1"),
            getMaxSeats: async () => 1,
          },
        });

        let arrivals = 0;
        let release!: () => void;
        const barrier = new Promise<void>((resolve) => {
          release = resolve;
        });
        const add = async (userId: string) => {
          return txManager.run(
            async () => {
              arrivals += 1;
              if (arrivals === 2) release();
              await barrier;
              return limitedService.addMember("tenant-1", userId, "member", `add:${userId}`);
            },
            { options: { isolationLevel } },
          );
        };

        const results = await Promise.allSettled([add("user-a"), add("user-b")]);

        expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
        expect(results.find((result) => result.status === "rejected")).toMatchObject({
          status: "rejected",
          reason: expect.any(problem),
        });
        await expect(store.countAll("tenant-1")).resolves.toBe(1);
        await expect(store.listPendingEventIntents()).resolves.toHaveLength(1);
      },
    );

    it("maps a repeatable-read loser to the stable last-owner Problem", async () => {
      let arrivals = 0;
      let release!: () => void;
      const barrier = new Promise<void>((resolve) => {
        release = resolve;
      });
      const remove = async (userId: string) => {
        return txManager.run(
          async () => {
            arrivals += 1;
            if (arrivals === 2) {
              release();
            }
            await barrier;
            return service.removeMember("tenant-1", userId, `remove:${userId}`);
          },
          { options: { isolationLevel: "repeatable read" } },
        );
      };

      const results = await Promise.allSettled([remove("owner-a"), remove("owner-b")]);

      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      expect(results.find((result) => result.status === "rejected")).toMatchObject({
        status: "rejected",
        reason: expect.any(LastOwnerCannotBeRemovedProblem),
      });
      await expect(store.countByRole("tenant-1", "owner")).resolves.toBe(1);
      await expect(
        Promise.all([
          store.hasExecutedCommand("remove:owner-a"),
          store.hasExecutedCommand("remove:owner-b"),
        ]),
      ).resolves.toEqual(expect.arrayContaining([true, false]));
      await expect(store.listPendingEventIntents()).resolves.toMatchObject([
        { events: [{ eventName: "membership.removed" }] },
      ]);
    });
  },
);

describe.skipIf(connectionString.length === 0).each(["UTC", "Asia/Seoul"])(
  "DrizzleMembershipStore timestamps in a %s PostgreSQL session",
  (timezone) => {
    let pool!: Pool;
    let store!: DrizzleMembershipStore;

    beforeAll(async () => {
      pool = new Pool({ connectionString, max: 2, options: `-c timezone=${timezone}` });
      const db = drizzle(pool);
      const client = db as unknown as DrizzleMembershipClient;
      store = new DrizzleMembershipStore(client, new TxManager(createDrizzleTxAdapter(client)));
      await pool.query(`
        create table if not exists memberships (
          id text primary key,
          tenant_id text not null,
          user_id text not null,
          role text not null,
          created_at timestamp not null default now(),
          updated_at timestamp not null default now(),
          unique (tenant_id, user_id)
        )
      `);
      await addMembershipSeatOrdinals({ execute: (query) => db.execute(query) });
      await setMembershipTimestampDefaults({ execute: (query) => db.execute(query) });
      await addMembershipEventIntents({ execute: (query) => db.execute(query) });
    });

    beforeEach(async () => {
      await pool.query(
        "truncate table membership_event_intents, membership_idempotency_records, memberships",
      );
    });

    afterAll(async () => {
      await pool.end();
    });

    it("reapplies UTC defaults without changing existing timestamps or column types", async () => {
      await pool.query(`
        alter table memberships
          alter column created_at set default now(),
          alter column updated_at set default now();
        insert into memberships (id, tenant_id, user_id, role, created_at, updated_at)
        values ('legacy', 'tenant-legacy', 'user-legacy', 'member', '2020-01-02 03:04:05', '2020-02-03 04:05:06');
      `);
      const db = drizzle(pool);
      const client = { execute: (query: Parameters<typeof db.execute>[0]) => db.execute(query) };
      await setMembershipTimestampDefaults(client);
      await setMembershipTimestampDefaults(client);

      const { rows } = await pool.query(`
        select created_at::text, updated_at::text,
          pg_typeof(created_at)::text as created_type,
          pg_typeof(updated_at)::text as updated_type
        from memberships where id = 'legacy'
      `);
      expect(rows).toEqual([
        {
          created_at: "2020-01-02 03:04:05",
          updated_at: "2020-02-03 04:05:06",
          created_type: "timestamp without time zone",
          updated_type: "timestamp without time zone",
        },
      ]);
      const service = new MembershipService({ store });
      const inserted = await service.addMember(
        "tenant-migrated",
        "user-migrated",
        "member",
        "add:migrated",
      );
      expect(Math.abs(inserted.createdAt.getTime() - Date.now())).toBeLessThan(1_000);
      expect(inserted.updatedAt).toEqual(inserted.createdAt);
    });

    it.each([null, 2])(
      "returns and reloads the actual creation instant with maxSeats=%s",
      async (maxSeats) => {
        const service = new MembershipService({
          store,
          eventPublisher: { publishIdempotently: async () => undefined },
          ...(maxSeats === null
            ? {}
            : {
                seatLimitChecker: {
                  checkSeatAvailability: async () => ({
                    usage: 0,
                    quota: maxSeats,
                    exceeded: false,
                    remaining: maxSeats,
                  }),
                  getCurrentMemberCount: async () => 0,
                  getMaxSeats: async () => maxSeats,
                },
              }),
        });
        const before = Date.now();
        const membership = await service.addMember("tenant-tz", "user-tz", "admin", "add:tz");
        const after = Date.now();
        const reloaded = await store.findByTenantAndUser("tenant-tz", "user-tz");

        expect(membership.createdAt.getTime()).toBeGreaterThanOrEqual(before - 1_000);
        expect(membership.createdAt.getTime()).toBeLessThanOrEqual(after + 1_000);
        expect(membership.updatedAt).toEqual(membership.createdAt);
        expect(reloaded).toEqual(membership);
        await expect(service.addMember("tenant-tz", "user-tz", "admin", "add:tz")).resolves.toEqual(
          membership,
        );

        await service.updateRole("tenant-tz", "user-tz", "member", "demote:tz");
        const updated = await store.findByTenantAndUser("tenant-tz", "user-tz");
        expect(updated).not.toBeNull();
        expect(updated?.createdAt).toEqual(membership.createdAt);
        expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(membership.createdAt.getTime());
      },
    );
  },
);
