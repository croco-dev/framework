import { existsSync } from "node:fs";
import { basename, dirname, join } from "node:path";

export function resolveCliBinFromEntry(entry: string): string {
  const entryDir = dirname(entry);
  const entryRoot = basename(entryDir);

  if (entryRoot !== "src" && entryRoot !== "dist") {
    throw createCliBinResolutionError(
      entry,
      "expected the entrypoint to be directly under 'src' or 'dist'",
    );
  }

  const bin = join(dirname(entryDir), "dist", "cli.js");
  if (!existsSync(bin)) {
    throw createCliBinResolutionError(entry, `expected '${bin}' to exist`);
  }

  return bin;
}

function createCliBinResolutionError(entry: string, expectation: string): Error {
  return new Error(
    `Unable to resolve delegated CLI binary from entrypoint '${entry}': ${expectation}. Rebuild or reinstall the package before retrying.`,
  );
}
