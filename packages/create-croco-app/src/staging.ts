import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  renameSync,
  rmSync,
  rmdirSync,
  statSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { DirectoryNotEmptyProblem } from "./libs/problems/DirectoryNotEmptyProblem.js";

const STAGING_PREFIX = `.croco-stage-${process.pid}-`;

export function createStagingDirectory(targetDir: string): string {
  assertTargetDirectoryAvailable(targetDir);
  mkdirSync(dirname(targetDir), { recursive: true });
  const stagingDir = mkdtempSync(join(dirname(targetDir), STAGING_PREFIX));

  if (process.platform !== "win32") {
    chmodSync(stagingDir, 0o777 & ~process.umask());
  }

  return stagingDir;
}

export function publishStagedProject(stagingDir: string, targetDir: string): void {
  assertTargetDirectoryAvailable(targetDir);

  if (existsSync(targetDir)) {
    rmdirSync(targetDir);
  }

  renameSync(stagingDir, targetDir);
}

export function removeOwnedStagingDirectory(stagingDir: string): void {
  rmSync(stagingDir, { recursive: true, force: true });
}

function assertTargetDirectoryAvailable(targetDir: string): void {
  if (!existsSync(targetDir)) {
    return;
  }

  if (!statSync(targetDir).isDirectory() || readdirSync(targetDir).length > 0) {
    throw new DirectoryNotEmptyProblem(targetDir);
  }
}
