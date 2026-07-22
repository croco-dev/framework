import { describe, expect, it } from "vitest";
import { resolveTemplatesDir } from "../template-path.js";

describe("template path resolution", () => {
  it("decodes spaces in packaged template URLs", () => {
    expect(resolveTemplatesDir("file:///tmp/Croco%20App/dist/index.js", "linux")).toBe(
      "/tmp/Croco App/templates",
    );
  });

  it("resolves Windows drive URLs without a leading slash", () => {
    expect(resolveTemplatesDir("file:///C:/Croco%20App/dist/index.js", "win32")).toBe(
      "C:\\Croco App\\templates",
    );
  });
});
