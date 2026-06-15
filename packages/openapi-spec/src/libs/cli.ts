import type { EmitOpenAPIOptions } from "./emitOpenAPI";

type CliOptions = {
  readonly controllers: string;
  readonly outFile: string;
  readonly title: string;
  readonly version: string;
  readonly servers: { readonly url: string }[];
  readonly bearerAuthScheme: string | null;
};

type CliParseResult =
  | { readonly kind: "help" }
  | { readonly kind: "invalid" }
  | { readonly kind: "run"; readonly options: CliOptions };

type CliIo = {
  readonly stdout: (message: string) => void;
};

const defaultCliIo: CliIo = {
  stdout: (message) => console.log(message),
};

export async function runCli(args: readonly string[], io: CliIo = defaultCliIo): Promise<number> {
  const result = parseArgs(args);

  if (result.kind === "help") {
    printHelp(io);
    return 0;
  }

  if (result.kind === "invalid") {
    printHelp(io);
    return 1;
  }

  const [{ writeFile }, { emitOpenAPI }, { loadControllers }] = await Promise.all([
    import("node:fs/promises"),
    import("./emitOpenAPI"),
    import("./loadControllers"),
  ]);
  const controllers = await loadControllers(result.options.controllers);
  const document = emitOpenAPI(controllers, toEmitOpenAPIOptions(result.options));

  await writeFile(result.options.outFile, JSON.stringify(document, null, 2));

  return 0;
}

export function parseArgs(args: readonly string[]): CliParseResult {
  if (args.includes("--help") || args.includes("-h")) {
    return { kind: "help" };
  }

  const controllers = getFlagValue(args, "--controllers");
  const outFile = getFlagValue(args, "--out");

  if (!controllers || !outFile) {
    return { kind: "invalid" };
  }

  return {
    kind: "run",
    options: {
      controllers,
      outFile,
      title: getFlagValue(args, "--title") ?? "Croco API",
      version: getFlagValue(args, "--version") ?? "1.0.0",
      servers: getFlagValues(args, "--server").map((url) => ({ url })),
      bearerAuthScheme: args.includes("--bearer-auth")
        ? (getFlagValue(args, "--bearer-auth") ?? "bearerAuth")
        : null,
    },
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

function getFlagValue(args: readonly string[], flag: string): string | null {
  const index = args.indexOf(flag);
  const value = index >= 0 ? args[index + 1] : undefined;

  return value && !value.startsWith("--") ? value : null;
}

function getFlagValues(args: readonly string[], flag: string): string[] {
  return args.flatMap((arg, index) => {
    if (arg !== flag) {
      return [];
    }

    const value = args[index + 1];

    return value && !value.startsWith("--") ? [value] : [];
  });
}

function printHelp(io: CliIo): void {
  io.stdout(`Usage: croco-openapi-spec --controllers <glob> --out <file> [--title <s>] [--version <s>] [--server <url>] [--bearer-auth [name]]

Options:
  --controllers <glob>  Controller files to load
  --out <file>          OpenAPI JSON output file
  --title <s>           API title (default: Croco API)
  --version <s>         API version (default: 1.0.0)
  --server <url>        Server URL to include; repeat for multiple servers
  --bearer-auth [name]  Add an HTTP bearer security scheme (default name: bearerAuth)`);
}
