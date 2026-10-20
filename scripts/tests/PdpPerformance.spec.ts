import { describe, expect, it } from "vitest";
import {
  assess,
  summarize,
  profile,
} from "../../examples/rsc-node-example/performance/profile.mjs";

const baseline = {
  correctness: true,
  conditions: { artifact: "build-a", cache: "cold", viewport: "390x844" },
  htmlBytes: 8100,
  flightBytes: 4100,
  jsBytes: 231000,
  imageBytes: 12000,
  requests: 5,
  ttfbMs: 45,
  shellMs: 90,
  heroMs: 160,
  lcpMs: 175,
  interactionMs: 32,
  hydrationReadyMs: 220,
};
describe("PDP performance evidence", () => {
  it("compares measured overhead only under identical artifact and device/cache conditions", () => {
    const current = { ...baseline, heroMs: 210, jsBytes: 250000 };
    expect(assess(current, baseline)).toMatchObject({ state: "passed", delta: { heroMs: 50 } });
    const mismatched = assess(
      { ...current, conditions: { ...baseline.conditions, cache: "warm" } },
      baseline,
    );
    expect(mismatched).toMatchObject({ state: "failed", diagnostics: ["PDP_COMPARISON_MISMATCH"] });
    expect(mismatched).not.toHaveProperty("delta");
  });
  it("rejects fast pages whose private or hydration correctness failed", () => {
    expect(assess({ ...baseline, correctness: false }, baseline)).toMatchObject({
      state: "failed",
      diagnostics: ["PDP_CORRECTNESS_FAILED"],
    });
  });
  it.each(["jsBytes", "imageBytes", "flightBytes", "htmlBytes", "requests"] as const)(
    "detects the %s boundary without rounding away an oversized result",
    (key) => {
      expect(assess({ ...baseline, [key]: profile.limits[key] }, baseline).state).toBe("passed");
      expect(
        assess({ ...baseline, [key]: profile.limits[key] + 1 }, baseline).diagnostics,
      ).toContain(`PDP_BUDGET_EXCEEDED:${key}`);
    },
  );
  it.each(["ttfbMs", "shellMs", "heroMs", "lcpMs", "interactionMs", "hydrationReadyMs"] as const)(
    "detects measured %s regression relative to its baseline",
    (key) => {
      expect(
        assess({ ...baseline, [key]: baseline[key] + profile.regression[key] }, baseline).state,
      ).toBe("passed");
      expect(
        assess({ ...baseline, [key]: baseline[key] + profile.regression[key] + 1 }, baseline)
          .diagnostics,
      ).toContain(`PDP_REGRESSION:${key}`);
    },
  );
  it.each([undefined, null, NaN, Infinity, -1])(
    "does not treat missing or invalid LCP %s as zero",
    (lcpMs) => {
      expect(assess({ ...baseline, lcpMs }, baseline).diagnostics).toContain(
        "PDP_MEASUREMENT_MISSING:lcpMs",
      );
    },
  );
  it("retains failed, unsupported and not-run rows in the human report without invented measurements", () => {
    const report = summarize([
      { configuration: "baseline", state: "passed", artifactRef: "baseline.json" },
      {
        configuration: "experiment",
        state: "failed",
        artifactRef: "experiment.json",
        reason: "budget exceeded",
      },
      {
        configuration: "personalization",
        state: "unsupported",
        artifactRef: "capabilities.json",
        reason: "missing adapter",
      },
      {
        configuration: "combined",
        state: "not_run",
        artifactRef: "capabilities.json",
        reason: "not executed",
      },
    ]);
    expect(report).toContain("| experiment | failed |");
    expect(report).toContain("| personalization | unsupported |");
    expect(report).toContain("| combined | not_run |");
    expect(report).not.toContain("0ms");
  });
});
