import { describe, expect, it } from "vitest";

import { buildCommentBody } from "../post-benchmark-comment.mjs";

describe("post-benchmark-comment.mjs", () => {
  it("includes gate failures and an explicit empty-report row", () => {
    const body = buildCommentBody(
      {
        allPassed: false,
        gateFailures: ["No benchmark reports were collected."],
        reports: [],
      },
      "1234567890abcdef",
    );

    expect(body).toContain("### Gate failures");
    expect(body).toContain("- No benchmark reports were collected.");
    expect(body).toContain(
      "| _No benchmark rows collected_ | - | - | - | - | ❌ | Check workflow logs. |",
    );
  });

  it("marks either threshold or baseline skip as a warning and includes the reason", () => {
    const body = buildCommentBody(
      {
        allPassed: false,
        reports: [
          {
            name: "Example benchmark",
            p75: 1,
            threshold: 2,
            baselineStatus: "skip",
            thresholdStatus: "pass",
            baselineSkipReason: "No baseline defined in benchmarks/baseline.json.",
          },
        ],
      },
      "1234567890abcdef",
    );

    expect(body).toContain(
      "| Example benchmark | 1.0ms | 2.0ms | - | - | ⚠️ | No baseline defined in benchmarks/baseline.json. |",
    );
  });
});
