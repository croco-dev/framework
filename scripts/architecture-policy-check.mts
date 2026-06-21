#!/usr/bin/env node

import {
  checkArchitecturePolicy,
  formatArchitecturePolicyDiagnostic,
  readArchitecturePolicyManifest,
} from "../packages/architecture-policy/src/index.ts";

type Options = {
  readonly manifest: string;
  readonly rootDir: string;
  readonly json: boolean;
};

function parseArgs(args: readonly string[]): Options {
  let manifest = "croco.arch.json";
  let rootDir = process.cwd();
  let json = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--manifest") {
      const value = readFlagValue(args, index, "--manifest");
      manifest = value;
      index += 1;
      continue;
    }

    if (arg === "--root") {
      const value = readFlagValue(args, index, "--root");
      rootDir = value;
      index += 1;
      continue;
    }

    if (arg === "--json") {
      json = true;
      continue;
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  return {
    manifest,
    rootDir,
    json,
  };
}

function readFlagValue(args: readonly string[], index: number, flag: string): string {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a path`);
  }

  return value;
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));
  const manifest = readArchitecturePolicyManifest(options.manifest);
  const report = checkArchitecturePolicy({
    rootDir: options.rootDir,
    manifest,
  });

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    for (const diagnostic of report.diagnostics) {
      console.error(formatArchitecturePolicyDiagnostic(diagnostic));
      if (diagnostic.recovery) {
        console.error(`  action: ${diagnostic.recovery}`);
      }
      console.error(`  evidence: ${diagnostic.excerpt}`);
    }
  }

  if (report.status === "fail") {
    console.error(`architecture-policy: ${report.diagnostics.length} diagnostic(s)`);
    process.exit(1);
  }

  console.log(
    `architecture-policy: passed for ${report.importCount} import(s) across ${report.packageCount} package(s)`,
  );
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`architecture-policy: failed: ${message}`);
  process.exit(1);
}
