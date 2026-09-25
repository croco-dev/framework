import { cpSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { dirname } from "node:path";

export function moveBuildOutput(
  source: string,
  destination: string,
  rename: typeof renameSync = renameSync,
): void {
  rmSync(destination, { force: true, recursive: true });
  mkdirSync(dirname(destination), { recursive: true });
  try {
    rename(source, destination);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EXDEV") throw error;
    cpSync(source, destination, { recursive: true });
  }
}
