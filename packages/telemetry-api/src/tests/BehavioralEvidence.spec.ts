import { describe, expect, it } from "vitest";
import { withSpan } from "../index";

describe("telemetry-api behavioral evidence", () => {
  it("returns the public span callback result to the caller", async () => {
    await expect(withSpan(() => "completed", { name: "evidence.success" })).resolves.toBe(
      "completed",
    );
  });

  it("propagates a public span callback failure to the caller", async () => {
    const failure = new Error("evidence failure");

    await expect(
      withSpan(
        () => {
          throw failure;
        },
        { name: "evidence.failure" },
      ),
    ).rejects.toBe(failure);
  });
});
