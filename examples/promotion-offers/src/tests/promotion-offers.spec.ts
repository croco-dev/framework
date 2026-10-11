import { describe, expect, it } from "vitest";
import { runPromotionOffers } from "../server";

describe("promotion offers example", () => {
  it("drives console draft, customer card, and a real ledger grant", async () => {
    const result = await runPromotionOffers();
    expect(result.quote.faceAmount).toBe("30");
    expect(result.grantRef.length).toBeGreaterThan(0);
    expect(result.available).toBe("30");
    expect(result.card).toContain("30 trial credits");
    expect(result.card).toContain("Decline");
    expect(result.benefits).toContain('data-state="fulfilled"');
    expect(result.console).toContain("welcome-trial v1");
    expect(result.console).toContain("budget 30/100");
  });
});
