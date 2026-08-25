import {
  formatContractDiagnostic,
  parseContractGraphStrictModeFlag,
  resolveContractGraphBlockingDiagnostics,
  type ContractGraph,
} from "@croco/protocols-core";
import type { GenerateClientProblemRuntime } from "./generate";

type CliOptions = {
  readonly controllers: string;
  readonly frontendActionManifestCheck: boolean;
  readonly frontendActionManifestPath: string | null;
  readonly manifestBundlePath: string | null;
  readonly outDir: string | null;
  readonly outputCheck: boolean;
  readonly problemRuntime: GenerateClientProblemRuntime;
  readonly reactQuery: boolean;
  readonly strictProblems: boolean;
  readonly strictSchemas: boolean;
  readonly tsconfigPath: string | null;
  readonly failOnDiagnostics: boolean;
  readonly check: boolean;
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

  const { loadContractGraph } = await import("./loadRoutes");
  const graph = await loadContractGraph(result.options.controllers, {
    strictProblemResponses: result.options.strictProblems,
    strictSchemas: result.options.strictSchemas,
    ...(result.options.tsconfigPath ? { tsconfigPath: result.options.tsconfigPath } : {}),
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
        ? `Contract graph contains ${blockingDiagnostics.length} diagnostic(s); fix them before generating clients.`
        : `Contract graph contains ${errors.length} error(s); fix them before generating clients.`,
    );
    return 1;
  }

  if (result.options.frontendActionManifestCheck) {
    return checkFrontendActionManifest(graph, result.options.frontendActionManifestPath, io);
  }

  const outDir = result.options.outDir;

  if (!outDir) {
    printHelp(io);
    return 1;
  }

  const generateOptions = toGenerateClientOptions(result.options);
  const { checkClientFilesFromContractGraph, generateClientFilesFromContractGraph } =
    await import("./generate");

  if (result.options.outputCheck) {
    const drifts = checkClientFilesFromContractGraph(graph, outDir, generateOptions);

    if (drifts.length === 0) {
      io.stdout(`Generated RPC outputs are current: ${outDir}`);
      return 0;
    }

    for (const drift of drifts) {
      io.stdout(`[CROCO_RPC_OUTPUT_${drift.status.toUpperCase()}] ${drift.filePath}`);
    }
    io.stdout(
      `RPC output drift detected. Regenerate with: ${formatRegenerationCommand(
        "croco-rpc-codegen",
        args,
        drifts.filter(({ status }) => status === "unexpected").map(({ filePath }) => filePath),
      )}`,
    );
    return 1;
  }

  const files = generateClientFilesFromContractGraph(graph, outDir, generateOptions);

  for (const file of files) {
    io.stdout(file);
  }

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
  const frontendActionManifestPath = getFlagValue(args, CLI_FLAGS.value.frontendActionManifest);
  const frontendActionManifestCheck = args.includes(CLI_FLAGS.boolean.frontendActionManifestCheck);
  const manifestBundlePath = getFlagValue(args, CLI_FLAGS.value.manifestBundle);
  const outDir = getFlagValue(args, CLI_FLAGS.value.out);
  const check = args.includes(CLI_FLAGS.boolean.check);
  const outputCheck = args.includes(CLI_FLAGS.boolean.outputCheck);
  const strictProblems = parseStrictProblems(args);
  const strictSchemas = parseStrictSchemas(args);
  const problemRuntime = parseProblemRuntime(args);
  const tsconfigPath = getFlagValue(args, CLI_FLAGS.value.tsconfig);

  if (
    !controllers ||
    (!outDir && !check && !frontendActionManifestCheck) ||
    (frontendActionManifestCheck && !frontendActionManifestPath) ||
    (frontendActionManifestCheck && outputCheck) ||
    (check && outputCheck) ||
    (args.includes(CLI_FLAGS.value.tsconfig) && !tsconfigPath) ||
    strictProblems === null ||
    strictSchemas === null ||
    !problemRuntime
  ) {
    return { kind: "invalid" };
  }

  return {
    kind: "run",
    options: {
      controllers,
      frontendActionManifestCheck,
      frontendActionManifestPath,
      manifestBundlePath,
      outDir,
      outputCheck,
      problemRuntime,
      reactQuery: args.includes(CLI_FLAGS.boolean.reactQuery),
      strictProblems,
      strictSchemas,
      tsconfigPath,
      failOnDiagnostics: args.includes(CLI_FLAGS.boolean.failOnDiagnostics),
      check,
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

function getFlagValue(args: readonly string[], flag: string): string | null {
  const index = args.indexOf(flag);
  const value = index >= 0 ? args[index + 1] : undefined;

  return value && !value.startsWith("--") ? value : null;
}

const CLI_FLAGS = {
  value: {
    controllers: "--controllers",
    frontendActionManifest: "--frontend-action-manifest",
    manifestBundle: "--manifest-bundle",
    out: "--out",
    problemRuntime: "--problem-runtime",
    tsconfig: "--tsconfig",
  },
  boolean: {
    check: "--check",
    compatibilityProblems: "--compatibility-problems",
    compatibilitySchemas: "--compatibility-schemas",
    failOnDiagnostics: "--fail-on-diagnostics",
    frontendActionManifestCheck: "--frontend-action-manifest-check",
    help: "--help",
    helpShort: "-h",
    outputCheck: "--output-check",
    reactQuery: "--react-query",
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

function parseProblemRuntime(args: readonly string[]): GenerateClientProblemRuntime | null {
  const hasFlag = args.includes(CLI_FLAGS.value.problemRuntime);
  const value = getFlagValue(args, CLI_FLAGS.value.problemRuntime);

  if (!value) {
    return hasFlag ? null : "inline";
  }

  return value === "inline" || value === "frontend-problems" ? value : null;
}

function toGenerateClientOptions(options: CliOptions): {
  readonly frontendActionManifestPath?: string;
  readonly manifestBundlePath?: string;
  readonly problemRuntime: GenerateClientProblemRuntime;
  readonly reactQuery: boolean;
} {
  return {
    ...(options.frontendActionManifestPath
      ? { frontendActionManifestPath: options.frontendActionManifestPath }
      : {}),
    ...(options.manifestBundlePath ? { manifestBundlePath: options.manifestBundlePath } : {}),
    problemRuntime: options.problemRuntime,
    reactQuery: options.reactQuery,
  };
}

function formatRegenerationCommand(
  binary: string,
  args: readonly string[],
  unexpectedPaths: readonly string[],
): string {
  const generationArgs = args.filter((argument) => argument !== CLI_FLAGS.boolean.outputCheck);
  const generationCommand = [binary, ...generationArgs].map(quoteShellArgument).join(" ");

  if (unexpectedPaths.length === 0) {
    return generationCommand;
  }

  return `rm -- ${unexpectedPaths.map(quoteShellArgument).join(" ")} && ${generationCommand}`;
}

function quoteShellArgument(argument: string): string {
  return /^[A-Za-z0-9_./:@%+=,-]+$/.test(argument)
    ? argument
    : `'${argument.replace(/'/g, `'"'"'`)}'`;
}

function printHelp(io: CliIo): void {
  io.stdout(`Usage: croco-rpc-codegen --controllers <glob> --out <dir> [--react-query] [--problem-runtime inline|frontend-problems] [--frontend-action-manifest <path>]
       croco-rpc-codegen --controllers <glob> --check [--strict-problems]
       croco-rpc-codegen --controllers <glob> --frontend-action-manifest <path> --frontend-action-manifest-check [--strict-problems]

Options:
  --controllers <glob>  Controller files to load
  --out <dir>           Output directory for generated clients
  --tsconfig <path>     Use an explicit application TypeScript config
  --react-query         Generate React Query hooks
  --problem-runtime     Generate inline helpers or import @croco/frontend-problems
  --frontend-action-manifest <path>
                       Write the frontend action manifest for generated REST RPC routes
  --frontend-action-manifest-check
                       Fail when the committed frontend action manifest drifts from current contracts
  --manifest-bundle <dir>
                       Generate a source reference to the shared Project manifest bundle
  --check               Validate the canonical contract graph without writing clients
  --output-check        Fail when generated client outputs drift without writing files
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

async function checkFrontendActionManifest(
  graph: ContractGraph,
  manifestPath: string | null,
  io: CliIo,
): Promise<number> {
  if (!manifestPath) {
    printHelp(io);
    return 1;
  }

  const [{ createFrontendActionManifestFromContractGraph }, { checkFrontendActionManifestFile }] =
    await Promise.all([import("./generate"), import("@croco/presentation-preset")]);
  const drift = await checkFrontendActionManifestFile(
    createFrontendActionManifestFromContractGraph(graph),
    manifestPath,
  );

  if (drift.ok) {
    io.stdout(`Frontend action manifest is current: ${manifestPath}`);
    return 0;
  }

  if (drift.status === "missing") {
    io.stdout(
      `Frontend action manifest is missing: ${manifestPath}. Run croco-rpc-codegen with --frontend-action-manifest ${manifestPath} and commit the generated file.`,
    );
    return 1;
  }

  io.stdout(
    `Frontend action manifest drift detected: ${manifestPath}. Run croco-rpc-codegen with --frontend-action-manifest ${manifestPath} and commit the generated file.`,
  );
  return 1;
}
