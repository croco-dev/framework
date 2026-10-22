import { describe, expect, it } from "vitest";
import { calculatePageExperience } from "@croco/metrics-core";
import { fixture } from "./fixture";
describe("Standalone page experience example", () => {
  it("uses a known three-session cohort", async () => {
    const report = await calculatePageExperience(fixture);
    expect(report.viewed).toBe(3);
    expect(report.engaged.numerator).toBe(2);
    expect(report.committed.numerator).toBe(1);
    expect(report.bounce.numerator).toBe(1);
  });
});
