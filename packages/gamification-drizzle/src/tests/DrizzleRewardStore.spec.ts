import { InvalidRewardPolicyProblem, RewardAccessDeniedProblem } from "@croco/gamification-core";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { describe, expect, it } from "vitest";
import { DrizzleRewardStore } from "../index";

describe("DrizzleRewardStore boundary validation", () => {
  const pool = new Pool();
  const store = new DrizzleRewardStore(drizzle(pool));
  it("rejects invalid scope and identifiers before any database access", async () => {
    await expect(
      store.getPolicy({ appId: "", environmentId: "test", tenantId: "tenant" }, "policy"),
    ).rejects.toBeInstanceOf(RewardAccessDeniedProblem);
    await expect(
      store.getAccount({ appId: "app", environmentId: "test", tenantId: "tenant" }, ""),
    ).rejects.toBeInstanceOf(InvalidRewardPolicyProblem);
  });
});
