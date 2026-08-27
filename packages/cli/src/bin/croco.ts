#!/usr/bin/env node
import { runMain } from "citty";
import { createCrocoCommand, normalizeMigrateRootArgs } from "../commands/root.js";
import type { MigrateCommandResult } from "../commands/migrate.js";

runMain(createCrocoCommand({ onMigrateResult: applyMigrateCommandResult }), {
  rawArgs: normalizeMigrateRootArgs(process.argv.slice(2)),
});

function applyMigrateCommandResult(result: MigrateCommandResult): void {
  if (result.status === "failed" && result.message !== undefined) {
    console.error(result.message);
  }
  process.exitCode = result.exitCode;
}
