import { describe, expect, it } from "vitest";
import { runPersonalizedPdp } from "../personalizedPdp";

describe("personalized PDP example", () => {
  it("reuses the public description while keeping private benefits request-local", async () => {
    const result = await runPersonalizedPdp();

    expect(result.alice).toContain("Trail Backpack 42L");
    expect(result.bob).toContain("Trail Backpack 42L");
    expect(result.alice).toContain("coupon-for-alice");
    expect(result.bob).toContain("coupon-for-bob");
    expect(result.alice).not.toContain("coupon-for-bob");

    const serialized = JSON.stringify(result.inspectLines);
    expect(serialized).not.toContain("coupon-for-alice");
    expect(serialized).not.toContain("coupon-for-bob");
    expect(result.inspectLines.some((line) => line.includes("zone=public"))).toBe(true);
    expect(result.inspectLines.some((line) => line.includes("zone=private"))).toBe(true);
  });
});
