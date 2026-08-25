import { dirname } from "node:path";
import {
  formatContractDiagnostic,
  parseContractGraphStrictModeFlag,
  resolveContractGraphBlockingDiagnostics,
} from "@croco/protocols-core";
import type { ContractGraph } from "@croco/protocols-core";
import type { EmitOpenAPIOptions } from "./emitOpenAPI";

type CliOptions = {
  readonly controllers: string;
  readonly outFile: string | null;
  readonly outputCheck: boolean;
  readonly title: string;
  readonly version: string;
  readonly servers: { readonly url: string }[];
  readonly bearerAuthScheme: string | null;
  readonly strictProblems: boolean;
  readonly strictSchemas: boolean;
  readonly tsconfigPath: string | null;
  readonly failOnDiagnostics: boolean;
  readonly check: boolean;
  readonly manifestBundlePath: string | null;
};

type CliParseResult =
  | { readonly kind: "help" }
  | { readonly kind: "invalid"; readonly diagnostic?: string }
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
    if (result.diagnostic) {
      io.stdout(result.diagnostic);
    }
    printHelp(io);
    return 1;
  }

  const [{ buildContractGraph }, { emitOpenAPIFromContractGraph }, { loadControllers }] =
    await Promise.all([
      import("@croco/protocols-core"),
      import("./emitOpenAPI"),
      import("./loadControllers"),
    ]);
  const controllers = await loadControllers(
    result.options.controllers,
    result.options.tsconfigPath ? { tsconfigPath: result.options.tsconfigPath } : {},
  );
  const graph = buildContractGraph(controllers, {
    strictProblemResponses: result.options.strictProblems,
    strictSchemas: result.options.strictSchemas,
  });

  if (result.options.check) {
    return reportContractGraph(graph, io, result.options.failOnDiagnostics);
  }

  const { blockingDiagnostics, errors } = resolveContractGraphBlockingDiagnostics(
    graph,
    result.options.failOnDiagnostics,
  );
  reportContractDiagnostics(graph, io);

  if (blockingDiagnostics.length > 0) {
    io.stdout(
      result.options.failOnDiagnostics
        ? `Contract graph contains ${blockingDiagnostics.length} diagnostic(s); fix them before generating OpenAPI.`
        : `Contract graph contains ${errors.length} error(s); fix them before generating OpenAPI.`,
    );
    return 1;
  }

  const outFile = result.options.outFile;

  if (!outFile) {
    printHelp(io);
    return 1;
  }

  const document = emitOpenAPIFromContractGraph(graph, toEmitOpenAPIOptions(result.options));
  const { checkOpenAPIOutput, serializeOpenAPIDocument } = await import("./output");
  const content = serializeOpenAPIDocument(document);

  if (result.options.outputCheck) {
    const drift = await checkOpenAPIOutput(outFile, content);

    if (!drift) {
      io.stdout(`Generated OpenAPI output is current: ${outFile}`);
      return 0;
    }

    io.stdout(`[CROCO_OPENAPI_OUTPUT_${drift.toUpperCase()}] ${outFile}`);
    io.stdout(
      `OpenAPI output drift detected. Regenerate with: ${formatRegenerationCommand("croco-openapi-spec", args)}`,
    );
    return 1;
  }

  const { mkdir, writeFile } = await import("node:fs/promises");
  await mkdir(dirname(outFile), { recursive: true });
  await writeFile(outFile, content);

  return 0;
}

export function parseArgs(args: readonly string[]): CliParseResult {
  const unsupportedArgument = findUnsupportedArgument(args);

  if (unsupportedArgument) {
    return { kind: "invalid", diagnostic: unsupportedArgument };
  }

  if (args.includes(CLI_FLAGS.boolean.help) || args.includes(CLI_FLAGS.boolean.helpShort)) {
    return { kind: "help" };
  }

  const controllers = getFlagValue(args, CLI_FLAGS.value.controllers);
  const outFile = getFlagValue(args, CLI_FLAGS.value.out);
  const check = args.includes(CLI_FLAGS.boolean.check);
  const outputCheck = args.includes(CLI_FLAGS.boolean.outputCheck);
  const strictProblems = parseStrictProblems(args);
  const strictSchemas = parseStrictSchemas(args);
  const tsconfigPath = getFlagValue(args, CLI_FLAGS.value.tsconfig);

  if (
    !controllers ||
    (!outFile && !check) ||
    (check && outputCheck) ||
    (args.includes(CLI_FLAGS.value.tsconfig) && !tsconfigPath) ||
    strictProblems === null ||
    strictSchemas === null
  ) {
    return { kind: "invalid" };
  }

  return {
    kind: "run",
    options: {
      controllers,
      outFile,
      outputCheck,
      title: getFlagValue(args, CLI_FLAGS.value.title) ?? "Croco API",
      version: getFlagValue(args, CLI_FLAGS.value.version) ?? "1.0.0",
      servers: getFlagValues(args, CLI_FLAGS.value.server).map((url) => ({ url })),
      bearerAuthScheme: args.includes(CLI_FLAGS.value.bearerAuth)
        ? (getFlagValue(args, CLI_FLAGS.value.bearerAuth) ?? "bearerAuth")
        : null,
      strictProblems,
      strictSchemas,
      tsconfigPath,
      failOnDiagnostics: args.includes(CLI_FLAGS.boolean.failOnDiagnostics),
      check,
      manifestBundlePath: getFlagValue(args, CLI_FLAGS.value.manifestBundle),
    },
  };
}

function parseStrictProblems(args: readonly string[]): boolean | null {
  return parseContractGraphStrictModeFlag(args, {
    strict: CLI_FLAGS.boolean.strictProblems,
    compatibility: CLI_FLAGS.boolean.compatibilityProblems,
  });
}

function parseStrictSchemas(args: readonly string[]): boolean | null {
  return parseContractGraphStrictModeFlag(args, {
    strict: CLI_FLAGS.boolean.strictSchemas,
    compatibility: CLI_FLAGS.boolean.compatibilitySchemas,
  });
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

const CLI_FLAGS = {
  value: {
    bearerAuth: "--bearer-auth",
    controllers: "--controllers",
    manifestBundle: "--manifest-bundle",
    out: "--out",
    server: "--server",
    title: "--title",
    tsconfig: "--tsconfig",
    version: "--version",
  },
  boolean: {
    check: "--check",
    compatibilityProblems: "--compatibility-problems",
    compatibilitySchemas: "--compatibility-schemas",
    failOnDiagnostics: "--fail-on-diagnostics",
    help: "--help",
    helpShort: "-h",
    outputCheck: "--output-check",
    strictProblems: "--strict-problems",
    strictSchemas: "--strict-schemas",
  },
} as const;

const VALUE_FLAGS: ReadonlySet<string> = new Set(Object.values(CLI_FLAGS.value));
const BOOLEAN_FLAGS: ReadonlySet<string> = new Set(Object.values(CLI_FLAGS.boolean));

function findUnsupportedArgument(args: readonly string[]): string | null {
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === undefined) {
      break;
    }

    if (VALUE_FLAGS.has(argument)) {
      const value = args[index + 1];

      if (value && !value.startsWith("--")) {
        index += 1;
      }
      continue;
    }

    if (BOOLEAN_FLAGS.has(argument)) {
      continue;
    }

    return argument.startsWith("-")
      ? `[CROCO_CLI_UNKNOWN_OPTION] Unknown option "${argument}".`
      : `[CROCO_CLI_UNEXPECTED_POSITIONAL] Unexpected positional argument "${argument}".`;
  }

  return null;
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

function formatRegenerationCommand(binary: string, args: readonly string[]): string {
  const generationArgs = args.filter((argument) => argument !== CLI_FLAGS.boolean.outputCheck);

  return [binary, ...generationArgs].map(quoteShellArgument).join(" ");
}

function quoteShellArgument(argument: string): string {
  return /^[A-Za-z0-9_./:@%+=,-]+$/.test(argument)
    ? argument
    : `'${argument.replace(/'/g, `'"'"'`)}'`;
}

function printHelp(io: CliIo): void {
  io.stdout(`Usage: croco-openapi-spec --controllers <glob> --out <file> [--title <s>] [--version <s>] [--server <url>] [--bearer-auth [name]]
       croco-openapi-spec --controllers <glob> --check [--strict-problems]

Options:
  --controllers <glob>  Controller files to load
  --out <file>          OpenAPI JSON output file
  --tsconfig <path>     Use an explicit application TypeScript config
  --title <s>           API title (default: Croco API)
  --version <s>         API version (default: 1.0.0)
  --server <url>        Server URL to include; repeat for multiple servers
  --bearer-auth [name]  Add an HTTP bearer security scheme (default name: bearerAuth)
  --manifest-bundle <dir>
                       Reference the shared Project manifest bundle in generated OpenAPI
  --check               Validate the canonical contract graph without writing OpenAPI
  --output-check        Fail when generated OpenAPI output drifts without writing files
  --strict-problems     Warn when routes do not declare generated client Problem unions (default)
  --compatibility-problems
                       Allow legacy routes without declared generated client Problem unions
  --strict-schemas      Require response, body, and named parameter schemas (default)
  --compatibility-schemas
                       Allow legacy schema-less routes during migration
  --fail-on-diagnostics
                       Treat warnings and errors as blocking before writing generated artifacts
  --help, -h            Show this help message`);
}

function reportContractGraph(graph: ContractGraph, io: CliIo, failOnDiagnostics: boolean): number {
  reportContractDiagnostics(graph, io);

  const { blockingDiagnostics, errors } = resolveContractGraphBlockingDiagnostics(
    graph,
    failOnDiagnostics,
  );

  if (blockingDiagnostics.length > 0) {
    io.stdout(
      failOnDiagnostics
        ? `Contract graph check failed with ${blockingDiagnostics.length} diagnostic(s).`
        : `Contract graph check failed with ${errors.length} error(s).`,
    );
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
