import { describe, expect, it } from "vitest";
import { createSeoFixture, seoDefinition } from "./fixture";

describe("Standalone SEO workbench", () => {
  it("executes raw normalized rows through the shared runner and admin boundary without a database", async () => {
    const fixture = createSeoFixture();
    const pure = await fixture.compare();
    const state = await fixture.operations.read(seoDefinition);
    expect(state.kind).toBe("ready");
    if ("page" in state) {
      expect(state.page.rows).toEqual(pure.rows);
      expect(state.page.report.inputHash).toBe(pure.inputHash);
    }
  });
});
