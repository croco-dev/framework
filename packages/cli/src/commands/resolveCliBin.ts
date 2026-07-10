import { basename, dirname, join } from "node:path";

export function resolveCliBinFromEntry(entry: string): string {
  const entryDir = dirname(entry);

  return basename(entryDir) === "src"
    ? join(dirname(entryDir), "dist", "cli.js")
    : join(entryDir, "cli.js");
}
