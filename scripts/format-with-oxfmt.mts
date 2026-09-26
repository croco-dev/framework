import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptRootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const FORMATTER_MAX_BUFFER_BYTES = 16 * 1024 * 1024;

export function formatWithOxfmt(
  filePath: string,
  content: string,
  rootDir: string = scriptRootDir,
): string {
  const localOxfmtPath = join(scriptRootDir, "node_modules", ".bin", "oxfmt");
  const hasLocalOxfmt = existsSync(localOxfmtPath);
  const result = spawnSync(
    hasLocalOxfmt ? localOxfmtPath : "pnpm",
    hasLocalOxfmt
      ? ["--stdin-filepath", filePath]
      : ["exec", "oxfmt", "--stdin-filepath", filePath],
    {
      cwd: rootDir,
      encoding: "utf-8",
      input: content,
      maxBuffer: FORMATTER_MAX_BUFFER_BYTES,
    },
  );

  if (result.error) {
    throw new Error(`oxfmt failed for ${filePath}: ${result.error.message}`, {
      cause: result.error,
    });
  }
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || result.stdout.trim() || `oxfmt failed for ${filePath}`);
  }

  return result.stdout;
}
