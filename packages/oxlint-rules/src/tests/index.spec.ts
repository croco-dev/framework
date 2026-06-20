import { describe, expect, it } from "vitest";
import plugin from "../index.ts";

describe("oxlint rules plugin", () => {
  it("exports the rule modules", () => {
    expect(plugin).toHaveProperty("rules");
    expect(Object.keys(plugin.rules)).toHaveLength(4);

    for (const rule of Object.values(plugin.rules)) {
      expect(rule).toHaveProperty("meta");
      expect(rule).toHaveProperty("create");
    }
  });
});
