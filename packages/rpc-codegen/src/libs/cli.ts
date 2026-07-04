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
  readonly problemRuntime: GenerateClientProblemRuntime;
  readonly reactQuery: boolean;
  readonly strictProblems: boolean;
  readonly strictSchemas: boolean;
  readonly failOnDiagnostics: boolean;
  readonly check: boolean;
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

  const { loadContractGraph } = await import("./loadRoutes");
  const graph = await loadContractGraph(result.options.controllers, {
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

  const { generateClientFilesFromContractGraph } = await import("./generate");
  const files = generateClientFilesFromContractGraph(graph, outDir, {
    ...(result.options.frontendActionManifestPath
      ? { frontendActionManifestPath: result.options.frontendActionManifestPath }
      : {}),
    ...(result.options.manifestBundlePath
      ? { manifestBundlePath: result.options.manifestBundlePath }
      : {}),
    problemRuntime: result.options.problemRuntime,
    reactQuery: result.options.reactQuery,
  });

  for (const file of files) {
    io.stdout(file);
  }

  return 0;
}

export function parseArgs(args: readonly string[]): CliParseResult {
  if (args.includes("--help") || args.includes("-h")) {
    return { kind: "help" };
  }

  const controllers = getFlagValue(args, "--controllers");
  const frontendActionManifestPath = getFlagValue(args, "--frontend-action-manifest");
  const frontendActionManifestCheck = args.includes("--frontend-action-manifest-check");
  const manifestBundlePath = getFlagValue(args, "--manifest-bundle");
  const outDir = getFlagValue(args, "--out");
  const check = args.includes("--check");
  const strictProblems = parseStrictProblems(args);
  const strictSchemas = parseStrictSchemas(args);
  const problemRuntime = parseProblemRuntime(args);

  if (
    !controllers ||
    (!outDir && !check && !frontendActionManifestCheck) ||
    (frontendActionManifestCheck && !frontendActionManifestPath) ||
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
      problemRuntime,
      reactQuery: args.includes("--react-query"),
      strictProblems,
      strictSchemas,
      failOnDiagnostics: args.includes("--fail-on-diagnostics"),
      check,
    },
  };
}

function parseStrictProblems(args: readonly string[]): boolean | null {
  return parseContractGraphStrictModeFlag(args, {
    strict: "--strict-problems",
    compatibility: "--compatibility-problems",
  });
}

function parseStrictSchemas(args: readonly string[]): boolean | null {
  return parseContractGraphStrictModeFlag(args, {
    strict: "--strict-schemas",
    compatibility: "--compatibility-schemas",
  });
}

function getFlagValue(args: readonly string[], flag: string): string | null {
  const index = args.indexOf(flag);
  const value = index >= 0 ? args[index + 1] : undefined;

  return value && !value.startsWith("--") ? value : null;
}

function parseProblemRuntime(args: readonly string[]): GenerateClientProblemRuntime | null {
  const hasFlag = args.includes("--problem-runtime");
  const value = getFlagValue(args, "--problem-runtime");

  if (!value) {
    return hasFlag ? null : "inline";
  }

  return value === "inline" || value === "frontend-problems" ? value : null;
}

function printHelp(io: CliIo): void {
  io.stdout(`Usage: croco-rpc-codegen --controllers <glob> --out <dir> [--react-query] [--problem-runtime inline|frontend-problems] [--frontend-action-manifest <path>]
       croco-rpc-codegen --controllers <glob> --check [--strict-problems]
       croco-rpc-codegen --controllers <glob> --frontend-action-manifest <path> --frontend-action-manifest-check [--strict-problems]

Options:
  --controllers <glob>  Controller files to load
  --out <dir>           Output directory for generated clients
  --react-query         Generate React Query hooks
  --problem-runtime     Generate inline helpers or import @croco/frontend-problems
  --frontend-action-manifest <path>
                       Write the frontend action manifest for generated REST RPC routes
  --frontend-action-manifest-check
                       Fail when the committed frontend action manifest drifts from current contracts
  --manifest-bundle <dir>
                       Generate a source reference to the shared Project manifest bundle
  --check               Validate the canonical contract graph without writing clients
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
