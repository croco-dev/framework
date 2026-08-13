import * as assert from "node:assert/strict";
import type { MembershipStore } from "./MembershipStore";
import {
  AlreadyMemberProblem,
  InvalidMembershipCommandProblem,
  MembershipIdempotencyConflictProblem,
} from "./problems/MembershipProblems";

export type MembershipStoreConformanceCase = { readonly name: string; run(): Promise<void> };

export function createMembershipStoreConformanceSuite(options: {
  readonly createStore: () => MembershipStore | Promise<MembershipStore>;
}): { readonly cases: readonly MembershipStoreConformanceCase[] } {
  return {
    cases: [
      {
        name: "atomically retains and replays state with one recoverable intent",
        run: async () => {
          const store = await options.createStore();
          const command = {
            operation: "add" as const,
            idempotencyKey: "conformance-add",
            membershipId: "membership-1",
            tenantId: "tenant-1",
            userId: "user-1",
            role: "member" as const,
            maxSeats: null,
          };
          const original = await store.execute(command);
          const replay = await store.execute(command);
          assert.equal(original.operation, "add");
          assert.equal(replay.replayed, true);
          assert.equal((await store.listPendingEventIntents()).length, 1);
          await assert.rejects(
            () => store.execute({ ...command, userId: "user-2" }),
            MembershipIdempotencyConflictProblem,
          );
        },
      },
      {
        name: "stores both ownership events in one intent",
        run: async () => {
          const store = await options.createStore();
          await store.save({ id: "owner", tenantId: "tenant-2", userId: "owner", role: "owner" });
          await store.save({
            id: "member",
            tenantId: "tenant-2",
            userId: "member",
            role: "member",
          });
          await store.execute({
            operation: "transfer_ownership",
            idempotencyKey: "conformance-transfer",
            tenantId: "tenant-2",
            fromUserId: "owner",
            toUserId: "member",
          });
          const intent = await store.getPendingEventIntent("conformance-transfer");
          assert.equal(intent?.events.length, 2);
          assert.notEqual(intent?.events[0]?.eventId, intent?.events[1]?.eventId);
        },
      },
      {
        name: "serializes distinct command keys for one membership",
        run: async () => {
          const store = await options.createStore();
          const results = await Promise.allSettled([
            store.execute({
              operation: "add",
              idempotencyKey: "conformance-concurrent-add-a",
              membershipId: "membership-a",
              tenantId: "tenant-concurrent",
              userId: "user-1",
              role: "member",
              maxSeats: null,
            }),
            store.execute({
              operation: "add",
              idempotencyKey: "conformance-concurrent-add-b",
              membershipId: "membership-b",
              tenantId: "tenant-concurrent",
              userId: "user-1",
              role: "admin",
              maxSeats: null,
            }),
          ]);
          assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
          const rejected = results.find((result) => result.status === "rejected");
          assert.ok(rejected?.status === "rejected");
          assert.ok(rejected.reason instanceof AlreadyMemberProblem);
          assert.equal((await store.listPendingEventIntents()).length, 1);
        },
      },
      {
        name: "binds successful no-op commands without creating events",
        run: async () => {
          const store = await options.createStore();
          await store.save({
            id: "membership-noop",
            tenantId: "tenant-noop",
            userId: "user-noop",
            role: "member",
          });
          const command = {
            operation: "update_role" as const,
            idempotencyKey: "conformance-noop",
            tenantId: "tenant-noop",
            userId: "user-noop",
            role: "member" as const,
          };
          const original = await store.execute(command);
          const replay = await store.execute(command);
          assert.equal(original.operation, "update_role");
          assert.equal(replay.replayed, true);
          assert.equal(await store.getPendingEventIntent(command.idempotencyKey), null);
          await assert.rejects(
            () => store.execute({ ...command, role: "admin" }),
            MembershipIdempotencyConflictProblem,
          );
        },
      },
      {
        name: "validates pending intent limits consistently",
        run: async () => {
          const store = await options.createStore();
          await assert.rejects(
            () => store.listPendingEventIntents(0),
            InvalidMembershipCommandProblem,
          );
          await assert.rejects(
            () => store.listPendingEventIntents(1_001),
            InvalidMembershipCommandProblem,
          );
        },
      },
    ],
  };
}
