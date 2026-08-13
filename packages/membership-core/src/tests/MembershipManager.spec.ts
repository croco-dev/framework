import "reflect-metadata";
import { describe, expect, it } from "vitest";
import { InMemoryMembershipStore } from "../libs/InMemoryMembershipStore";
import { MembershipManager } from "../libs/MembershipManager";

describe("MembershipManager", () => {
  it("preserves the MembershipService command contract", async () => {
    const manager = new MembershipManager({
      store: new InMemoryMembershipStore(),
      eventDelivery: "development",
      eventPublisher: { publishIdempotently: async () => undefined },
      idGenerator: () => "membership-1",
    });

    await expect(
      manager.addMember("tenant-1", "user-1", "member", "add:user-1"),
    ).resolves.toMatchObject({ id: "membership-1", role: "member" });
  });
});
