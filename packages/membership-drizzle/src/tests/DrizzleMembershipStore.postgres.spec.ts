import "reflect-metadata";
import { LastOwnerCannotBeRemovedProblem, MembershipService } from "@croco/membership-core";
import { TxManager } from "@croco/tx-core";
import { createDrizzleTxAdapter } from "@croco/tx-drizzle";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  type DrizzleMembershipClient,
  DrizzleMembershipStore,
} from "../libs/DrizzleMembershipStore";

const connectionString = process.env.MEMBERSHIP_POSTGRES_URL ?? "";

describe.skipIf(connectionString.length === 0)(
  "DrizzleMembershipStore PostgreSQL concurrency",
  () => {
    let pool!: Pool;
    let service!: MembershipService;
    let store!: DrizzleMembershipStore;
    let txManager!: TxManager<DrizzleMembershipClient>;

    beforeAll(async () => {
      pool = new Pool({ connectionString, max: 4 });
      const db = drizzle(pool);
      const client = db as unknown as DrizzleMembershipClient;
      txManager = new TxManager(createDrizzleTxAdapter(client));
      store = new DrizzleMembershipStore(client, txManager);
      service = new MembershipService(store, {
        publishAfterCommit: () => undefined,
        publishNow: async () => undefined,
        publishMany: async () => undefined,
      } as unknown as ConstructorParameters<typeof MembershipService>[1]);

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
    });

    beforeEach(async () => {
      await pool.query("truncate table memberships");
      await store.save({
        id: "membership-a",
        tenantId: "tenant-1",
        userId: "owner-a",
        role: "owner",
      });
      await store.save({
        id: "membership-b",
        tenantId: "tenant-1",
        userId: "owner-b",
        role: "owner",
      });
    });

    afterAll(async () => {
      await pool.end();
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
              return store.mutateOwner({
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
            return store.mutateOwner({
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
            return service.removeMember("tenant-1", userId);
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
    });
  },
);
