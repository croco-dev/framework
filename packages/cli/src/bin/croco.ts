#!/usr/bin/env node
import { runMain } from "citty";
import { createCrocoCommand, normalizeMigrateRootArgs } from "../commands/root.js";

runMain(createCrocoCommand(), {
  rawArgs: normalizeMigrateRootArgs(process.argv.slice(2)),
});
