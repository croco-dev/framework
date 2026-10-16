import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getPackageVersion } from "../package-version.js";

vi.mock("node:fs", () => ({ readFileSync: vi.fn() }));

describe("getPackageVersion", () => {
  afterEach(() => vi.resetAllMocks());

  it.each([undefined, "", 42])("reports invalid version %s as a coded Problem", (version) => {
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ version }));
    expect(getPackageVersion).toThrow(
      expect.objectContaining({ code: "create-croco-app/missing-package-version" }),
    );
  });

  it("returns a configured package version", () => {
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ version: "2.7.3" }));
    expect(getPackageVersion()).toBe("2.7.3");
  });
});
