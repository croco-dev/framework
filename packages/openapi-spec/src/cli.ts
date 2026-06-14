#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import { emitOpenAPI } from "./libs/emitOpenAPI";
import { loadControllers } from "./libs/loadControllers";

type CliOptions = {
  readonly controllers: string;
  readonly outFile: string;
  readonly title: string;
  readonly version: string;
};

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  if (!options) {
    printHelp();
    process.exitCode = 1;
    return;
  }

  const controllers = await loadControllers(options.controllers);
  const document = emitOpenAPI(controllers);
  document.info.title = options.title;
  document.info.version = options.version;

  await writeFile(options.outFile, JSON.stringify(document, null, 2));
}

function parseArgs(args: string[]): CliOptions | null {
  if (args.includes("--help") || args.includes("-h")) {
    return null;
  }

  const controllers = getFlagValue(args, "--controllers");
  const outFile = getFlagValue(args, "--out");

  if (!controllers || !outFile) {
    return null;
  }

  return {
    controllers,
    outFile,
    title: getFlagValue(args, "--title") ?? "Croco API",
    version: getFlagValue(args, "--version") ?? "1.0.0",
  };
}

function getFlagValue(args: string[], flag: string): string | null {
  const index = args.indexOf(flag);
  const value = index >= 0 ? args[index + 1] : undefined;

  return value && !value.startsWith("--") ? value : null;
}

function printHelp(): void {
  console.log(`Usage: croco-openapi-spec --controllers <glob> --out <file> [--title <s>] [--version <s>]

Options:
  --controllers <glob>  Controller files to load
  --out <file>          OpenAPI JSON output file
  --title <s>           API title (default: Croco API)
  --version <s>         API version (default: 1.0.0)`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
