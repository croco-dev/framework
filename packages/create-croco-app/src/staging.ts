import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  renameSync,
  rmSync,
  rmdirSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { DirectoryNotEmptyProblem } from "./libs/problems/DirectoryNotEmptyProblem.js";

const STAGING_PREFIX = `.croco-stage-${process.pid}-`;

export function createStagingDirectory(targetDir: string): string {
  assertTargetDirectoryAvailable(targetDir);
  mkdirSync(dirname(targetDir), { recursive: true });
  return mkdtempSync(join(dirname(targetDir), STAGING_PREFIX));
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
  if (existsSync(targetDir) && readdirSync(targetDir).length > 0) {
    throw new DirectoryNotEmptyProblem(targetDir);
  }
}
