import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("Sitemap browser", () => {
  it("previews exclusions, publishes by keyboard and preserves the report after source failure", async () => {
    const result = await promisify(execFile)(
      process.execPath,
      [fileURLToPath(new URL("./sitemapBrowser.cjs", import.meta.url))],
      { timeout: 45000 },
    );
    expect(JSON.parse(result.stdout)).toMatchObject({
      keyboardPublish: "passed",
      readOnly: "passed",
      sourceFailure: "preserved",
      errors: [],
    });
    console.log(result.stdout);
  }, 50000);
});
