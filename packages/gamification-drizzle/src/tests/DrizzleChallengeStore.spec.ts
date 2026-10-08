import { describe, expect, it } from "vitest";
import { ChallengeInvalidProblem } from "@croco/gamification-core";
import { DrizzleChallengeStore } from "../index";

describe("DrizzleChallengeStore scope boundary", () => {
  it("rejects invalid scope before database access", async () => {
    const store = new DrizzleChallengeStore(
      {} as ConstructorParameters<typeof DrizzleChallengeStore>[0],
    );
    await expect(
      store.transact(
        { app: "", environment: "test", tenantId: "tenant" },
        "challenge",
        async () => null,
      ),
    ).rejects.toBeInstanceOf(ChallengeInvalidProblem);
  });
});
