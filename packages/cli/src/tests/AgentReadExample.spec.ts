import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

const setupUrl = new URL("../../examples/agent-read/setup.mjs", import.meta.url).href;
const setup = (await import(setupUrl)) as { createExampleFiles(root: string): Promise<void> };

describe("agent read example", () => {
  it("keeps its repository and commit isolated from inherited Git hook context", async () => {
    const parent = await mkdtemp(join(tmpdir(), "croco-agent-parent-"));
    const child = await mkdtemp(join(tmpdir(), "croco-agent-child-"));
    const env = { ...process.env };
    for (const name of ["GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "GIT_COMMON_DIR"]) {
      delete env[name];
    }
    const git = (cwd: string, args: string[]) =>
      execFileSync("git", ["-C", cwd, ...args], { env, encoding: "utf8" }).trim();

    try {
      await setup.createExampleFiles(parent);
      await writeFile(join(parent, "parent-only.txt"), "Keep this staged in the parent.\n");
      git(parent, ["add", "parent-only.txt"]);
      const parentHead = git(parent, ["rev-parse", "HEAD"]);
      const parentTree = git(parent, ["write-tree"]);

      vi.stubEnv("GIT_DIR", join(parent, ".git"));
      vi.stubEnv("GIT_INDEX_FILE", join(parent, ".git", "index"));
      await setup.createExampleFiles(child);

      expect(git(child, ["rev-parse", "--show-toplevel"])).toBe(await realpath(child));
      expect(git(child, ["ls-files"])).toBe("frontend-actions.json");
      expect((await readFile(join(child, "source-commit.txt"), "utf8")).trim()).toBe(
        git(child, ["rev-parse", "HEAD"]),
      );
      expect(git(parent, ["rev-parse", "--is-bare-repository"])).toBe("false");
      expect(git(parent, ["rev-parse", "HEAD"])).toBe(parentHead);
      expect(git(parent, ["write-tree"])).toBe(parentTree);
    } finally {
      vi.unstubAllEnvs();
      await Promise.all([
        rm(parent, { recursive: true, force: true }),
        rm(child, { recursive: true, force: true }),
      ]);
    }
  });
});
