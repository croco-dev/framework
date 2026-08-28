import { describe, expect, it, vi } from "vitest";

type SpawnResult = {
  readonly status: number | null;
  readonly stderr: string;
  readonly stdout: string;
};

type SpawnSync = (
  command: string,
  arguments_: readonly string[],
  options: {
    readonly cwd: string;
    readonly encoding: "utf8";
    readonly maxBuffer: number;
    readonly timeout: number;
  },
) => SpawnResult;

type FileURLToPath = (url: URL) => string;

describe("desktop type fixtures", () => {
  it("executes negative diagnostics and the large application compile contract", async () => {
    const { spawnSync } = await vi.importActual<{ readonly spawnSync: SpawnSync }>(
      "node:child_process",
    );
    const { fileURLToPath } = await vi.importActual<{
      readonly fileURLToPath: FileURLToPath;
    }>("node:url");
    const rootDir = fileURLToPath(new URL("../../../..", import.meta.url));
    const result = spawnSync("pnpm", ["desktop-contracts:type-fixtures"], {
      cwd: rootDir,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      timeout: 180_000,
    });

    expect(`${result.stdout}${result.stderr}`).toContain(
      "7 negative contracts and 200-command/20-window fixture passed",
    );
    expect(result.status).toBe(0);
  }, 180_000);
});
