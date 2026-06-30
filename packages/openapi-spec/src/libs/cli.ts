import { formatContractDiagnostic, getContractGraphErrors } from "@croco/protocols-core";
import type { ContractGraph } from "@croco/protocols-core";
import type { EmitOpenAPIOptions } from "./emitOpenAPI";

type CliOptions = {
  readonly controllers: string;
  readonly outFile: string | null;
  readonly title: string;
  readonly version: string;
  readonly servers: { readonly url: string }[];
  readonly bearerAuthScheme: string | null;
  readonly strictProblems: boolean;
  readonly strictSchemas: boolean;
  readonly check: boolean;
  readonly manifestBundlePath: string | null;
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

  const [
    { writeFile },
    { buildContractGraph },
    { emitOpenAPIFromContractGraph },
    { loadControllers },
  ] = await Promise.all([
    import("node:fs/promises"),
    import("@croco/protocols-core"),
    import("./emitOpenAPI"),
    import("./loadControllers"),
  ]);
  const controllers = await loadControllers(result.options.controllers);
  const graph = buildContractGraph(controllers, {
    strictProblemResponses: result.options.strictProblems,
    strictSchemas: result.options.strictSchemas,
  });

  if (result.options.check) {
    return reportContractGraph(graph, io);
  }

  const errors = getContractGraphErrors(graph);
  reportContractDiagnostics(graph, io);

  if (errors.length > 0) {
    io.stdout(
      `Contract graph contains ${errors.length} error(s); fix them before generating OpenAPI.`,
    );
    return 1;
  }

  const outFile = result.options.outFile;

  if (!outFile) {
    printHelp(io);
    return 1;
  }

  const document = emitOpenAPIFromContractGraph(graph, toEmitOpenAPIOptions(result.options));

  await writeFile(outFile, JSON.stringify(document, null, 2));

  return 0;
}

export function parseArgs(args: readonly string[]): CliParseResult {
  if (args.includes("--help") || args.includes("-h")) {
    return { kind: "help" };
  }

  const controllers = getFlagValue(args, "--controllers");
  const outFile = getFlagValue(args, "--out");
  const check = args.includes("--check");

  if (!controllers || (!outFile && !check)) {
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
      strictProblems: args.includes("--strict-problems"),
      strictSchemas: args.includes("--strict-schemas"),
      check,
      manifestBundlePath: getFlagValue(args, "--manifest-bundle"),
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
    ...(options.manifestBundlePath ? { manifestBundlePath: options.manifestBundlePath } : {}),
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
       croco-openapi-spec --controllers <glob> --check [--strict-problems]

Options:
  --controllers <glob>  Controller files to load
  --out <file>          OpenAPI JSON output file
  --title <s>           API title (default: Croco API)
  --version <s>         API version (default: 1.0.0)
  --server <url>        Server URL to include; repeat for multiple servers
  --bearer-auth [name]  Add an HTTP bearer security scheme (default name: bearerAuth)
  --manifest-bundle <dir>
                       Reference the shared Project manifest bundle in generated OpenAPI
  --check               Validate the canonical contract graph without writing OpenAPI
  --strict-problems     Warn when routes do not declare generated client Problem unions
  --strict-schemas      Fail when generated routes omit response, body, or named parameter schemas
  --help, -h            Show this help message`);
}

function reportContractGraph(graph: ContractGraph, io: CliIo): number {
  reportContractDiagnostics(graph, io);

  const errors = getContractGraphErrors(graph);

  if (errors.length > 0) {
    io.stdout(`Contract graph check failed with ${errors.length} error(s).`);
    return 1;
  }

  io.stdout(
    `Contract graph check passed for ${graph.routes.length} route(s) across ${graph.controllers.length} controller(s).`,
  );

  return 0;
}

function reportContractDiagnostics(graph: ContractGraph, io: CliIo): void {
  for (const diagnostic of graph.diagnostics) {
    io.stdout(formatContractDiagnostic(diagnostic));
  }
}
