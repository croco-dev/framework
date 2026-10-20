import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
describe("SeoWorkbench", () => {
  it("compares real raw inputs through permissions and runner with keyboard filters, details, masking, save/export and explicit quality states", () => {
    const runner = fileURLToPath(new URL("./seoWorkbenchBrowser.cjs", import.meta.url));
    const result = JSON.parse(
      execFileSync(process.execPath, [runner], { encoding: "utf8", timeout: 60000 }),
    );
    expect(result).toMatchObject({ saved: true, exported: true, errors: [], overflow: false });
  }, 65000);
});
