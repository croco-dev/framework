#!/usr/bin/env node
import { runCroco } from "../commands/root.js";

const result = await runCroco(process.argv.slice(2));
process.exitCode = result.exitCode;
