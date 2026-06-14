#!/usr/bin/env node
import { generateClientFiles } from "./libs/generate";
import { loadRoutes } from "./libs/loadRoutes";

type CliOptions = {
  readonly controllers: string;
  readonly outDir: string;
  readonly reactQuery: boolean;
};

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  if (!options) {
    printHelp();
    return;
  }

  const routes = await loadRoutes(options.controllers);
  const files = generateClientFiles(routes, options.outDir, { reactQuery: options.reactQuery });

  for (const file of files) {
    console.log(file);
  }
}

function parseArgs(args: string[]): CliOptions | null {
  if (args.includes("--help") || args.includes("-h")) {
    return null;
  }

  const controllers = getFlagValue(args, "--controllers");
  const outDir = getFlagValue(args, "--out");

  if (!controllers || !outDir) {
    return null;
  }

  return {
    controllers,
    outDir,
    reactQuery: args.includes("--react-query"),
  };
}

function getFlagValue(args: string[], flag: string): string | null {
  const index = args.indexOf(flag);
  const value = index >= 0 ? args[index + 1] : undefined;

  return value && !value.startsWith("--") ? value : null;
}

function printHelp(): void {
  console.log(`Usage: croco-rpc-codegen --controllers <glob> --out <dir> [--react-query]

Options:
  --controllers <glob>  Controller files to load
  --out <dir>           Output directory for generated clients
  --react-query         Generate React Query hooks
  --help, -h            Show this help message`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
