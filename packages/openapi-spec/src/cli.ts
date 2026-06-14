#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import { emitOpenAPI, type EmitOpenAPIOptions } from "./libs/emitOpenAPI";
import { loadControllers } from "./libs/loadControllers";

type CliOptions = {
  readonly controllers: string;
  readonly outFile: string;
  readonly title: string;
  readonly version: string;
  readonly servers: { readonly url: string }[];
  readonly bearerAuthScheme: string | null;
};

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  if (!options) {
    printHelp();
    process.exitCode = 1;
    return;
  }

  const controllers = await loadControllers(options.controllers);
  const document = emitOpenAPI(controllers, toEmitOpenAPIOptions(options));

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
    servers: getFlagValues(args, "--server").map((url) => ({ url })),
    bearerAuthScheme: args.includes("--bearer-auth")
      ? (getFlagValue(args, "--bearer-auth") ?? "bearerAuth")
      : null,
  };
}

function toEmitOpenAPIOptions(options: CliOptions): EmitOpenAPIOptions {
  return {
    info: {
      title: options.title,
      version: options.version,
    },
    ...(options.servers.length > 0 ? { servers: options.servers } : {}),
    ...(options.bearerAuthScheme
      ? {
          security: [{ [options.bearerAuthScheme]: [] }],
          securitySchemes: {
            [options.bearerAuthScheme]: {
              type: "http",
              scheme: "bearer",
              bearerFormat: "JWT",
            },
          },
        }
      : {}),
  };
}

function getFlagValue(args: string[], flag: string): string | null {
  const index = args.indexOf(flag);
  const value = index >= 0 ? args[index + 1] : undefined;

  return value && !value.startsWith("--") ? value : null;
}

function getFlagValues(args: string[], flag: string): string[] {
  return args.flatMap((arg, index) => {
    if (arg !== flag) {
      return [];
    }

    const value = args[index + 1];

    return value && !value.startsWith("--") ? [value] : [];
  });
}

function printHelp(): void {
  console.log(`Usage: croco-openapi-spec --controllers <glob> --out <file> [--title <s>] [--version <s>] [--server <url>] [--bearer-auth [name]]

Options:
  --controllers <glob>  Controller files to load
  --out <file>          OpenAPI JSON output file
  --title <s>           API title (default: Croco API)
  --version <s>         API version (default: 1.0.0)
  --server <url>        Server URL to include; repeat for multiple servers
  --bearer-auth [name]  Add an HTTP bearer security scheme (default name: bearerAuth)`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
