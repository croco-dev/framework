import {
  formatContractDiagnostic,
  getContractGraphErrors,
  type ContractGraph,
} from "@croco/protocols-core";

type CliOptions = {
  readonly controllers: string;
  readonly outDir: string | null;
  readonly reactQuery: boolean;
  readonly strictProblems: boolean;
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
  });

  if (result.options.check) {
    return reportContractGraph(graph, io);
  }

  const errors = getContractGraphErrors(graph);

  if (errors.length > 0) {
    reportContractDiagnostics(graph, io);
    io.stdout(
      `Contract graph contains ${errors.length} error(s); fix them before generating clients.`,
    );
    return 1;
  }

  const outDir = result.options.outDir;

  if (!outDir) {
    printHelp(io);
    return 1;
  }

  const { generateClientFilesFromContractGraph } = await import("./generate");
  const files = generateClientFilesFromContractGraph(graph, outDir, {
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
  const outDir = getFlagValue(args, "--out");
  const check = args.includes("--check");
  const strictProblems = args.includes("--strict-problems");

  if (!controllers || (!outDir && !check)) {
    return { kind: "invalid" };
  }

  return {
    kind: "run",
    options: {
      controllers,
      outDir,
      reactQuery: args.includes("--react-query"),
      strictProblems,
      check,
    },
  };
}

function getFlagValue(args: readonly string[], flag: string): string | null {
  const index = args.indexOf(flag);
  const value = index >= 0 ? args[index + 1] : undefined;

  return value && !value.startsWith("--") ? value : null;
}

function printHelp(io: CliIo): void {
  io.stdout(`Usage: croco-rpc-codegen --controllers <glob> --out <dir> [--react-query]
       croco-rpc-codegen --controllers <glob> --check [--strict-problems]

Options:
  --controllers <glob>  Controller files to load
  --out <dir>           Output directory for generated clients
  --react-query         Generate React Query hooks
  --check               Validate the canonical contract graph without writing clients
  --strict-problems     Warn when routes do not declare generated client Problem unions
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
