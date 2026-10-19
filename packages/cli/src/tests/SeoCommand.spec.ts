import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runCroco } from "../commands/root";

describe("SeoCommand", () => {
  it("resolves app configuration under cwd and renders identical human and JSON diagnostics", async () => {
    const directory = await mkdtemp(join(tmpdir(), "croco-seo-cli-"));
    try {
      await writeFile(
        join(directory, "public-pages.mjs"),
        `export const inspect = async (targetId) => ({targetId, state:'partial', diagnostics:[{code:'SEO_CANONICAL_MISMATCH',field:'canonical'}]});`,
      );
      const output: string[] = [];
      const dependencies = {
        cwd: directory,
        stdout: (message: string) => output.push(message),
        stderr: (message: string) => output.push(message),
      };
      expect(
        (
          await runCroco(
            ["seo", "--config", "public-pages.mjs", "--target", "p7", "--json"],
            dependencies,
          )
        ).exitCode,
      ).toBe(1);
      expect(JSON.parse(output.join(""))).toEqual({
        targetId: "p7",
        state: "partial",
        diagnostics: [{ code: "SEO_CANONICAL_MISMATCH", field: "canonical" }],
      });
      output.length = 0;
      expect(
        (await runCroco(["seo", "--config", "public-pages.mjs", "--target", "p7"], dependencies))
          .exitCode,
      ).toBe(1);
      expect(output.join("")).toBe("p7: partial\nSEO_CANONICAL_MISMATCH (canonical)");
      await writeFile(
        join(directory, "ready.mjs"),
        `export const inspect = async (targetId) => ({targetId, state:'ready', diagnostics:[]});`,
      );
      expect(
        (await runCroco(["seo", "--config", "ready.mjs", "--target", "p8"], dependencies)).exitCode,
      ).toBe(0);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

it("loads the inspector config from the explicit cwd option", async () => {
  const directory = await mkdtemp(join(tmpdir(), "croco-seo-cwd-"));
  try {
    await writeFile(
      join(directory, "ready.mjs"),
      `export const inspect = async (targetId) => ({targetId, state:'ready', diagnostics:[]});`,
    );
    const output: string[] = [];
    const errors: string[] = [];
    const result = await runCroco(
      [
        "seo",
        "--cwd",
        directory,
        "--config",
        "ready.mjs",
        "--target",
        "selected-preview",
        "--json",
      ],
      {
        cwd: tmpdir(),
        stdout: (message) => output.push(message),
        stderr: (message) => errors.push(message),
      },
    );
    expect(result.exitCode).toBe(0);
    expect(errors).toEqual([]);
    expect(JSON.parse(output.join(""))).toEqual({
      targetId: "selected-preview",
      state: "ready",
      diagnostics: [],
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
