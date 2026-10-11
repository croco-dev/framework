import { describe, expect, it } from "vitest";
import { ChallengeInvalidProblem } from "@croco/gamification-core";
import { drizzle } from "drizzle-orm/node-postgres";
import {
  DrizzleChallengeStore,
  gamificationChallengeBuckets,
  gamificationChallenges,
  gamificationChallengeMembers,
  gamificationChallengeContributions,
  gamificationChallengeReceipts,
  gamificationChallengeCompletions,
  gamificationChallengeErasedEvents,
  gamificationChallengeErasedSubjects,
  gamificationChallengeEvidenceAttempts,
} from "../index";

describe("DrizzleChallengeStore scope boundary", () => {
  it("accepts a database with only the cooperative challenge tables", () => {
    const db = drizzle.mock({
      schema: {
        gamificationChallengeBuckets,
        gamificationChallenges,
        gamificationChallengeMembers,
        gamificationChallengeContributions,
        gamificationChallengeReceipts,
        gamificationChallengeCompletions,
        gamificationChallengeErasedEvents,
        gamificationChallengeErasedSubjects,
        gamificationChallengeEvidenceAttempts,
      },
    });
    expect(new DrizzleChallengeStore(db)).toBeInstanceOf(DrizzleChallengeStore);
  });
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
