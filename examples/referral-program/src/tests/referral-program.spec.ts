import { describe, expect, it } from "vitest";
import { runReferralProgram } from "../server";

describe("referral program example", () => {
  it("drives clicks, claim, qualify, fulfill, cancel, and return with console evidence", async () => {
    const result = await runReferralProgram();
    expect(result.funnel.clicks).toBe(3);
    expect(result.funnel.qualified).toBe(1);
    expect(result.console).toContain("referral-welcome");
    expect(result.console).toContain("budget");
    expect(result.card).toContain("shop.example/referrals/claim");
    expect(result.card).toContain("qualified");
  });
});
