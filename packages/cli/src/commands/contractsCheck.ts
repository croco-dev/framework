import { dirname, resolve } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { defineCommand } from "citty";
import {
  createContractGraphSnapshot,
  formatContractDiagnostic,
  getContractGraphErrors,
  stringifyContractGraphSnapshot,
  type BuildContractGraphOptions,
  type ContractGraph,
} from "@croco/protocols-core";
import { getCrocoCommandRuntime } from "../libs/cliRuntime.js";

const CHECK_OPTIONS = {
  controllers: { type: "string", description: "Controller files to load" },
  json: { type: "boolean", description: "Print a stable ContractGraph snapshot JSON report" },
  out: { type: "string", description: "Write the stable snapshot JSON report to a file" },
  "strict-schemas": {
    type: "boolean",
    description: "Fail when routes omit response, body, or named parameter schemas",
  },
} as const;

export type ContractGraphLoader = (
  glob: string,
  options: BuildContractGraphOptions,
) => Promise<ContractGraph>;

export type ContractsCheckIo = {
  readonly stdout: (message: string) => void;
  readonly stderr: (message: string) => void;
  readonly writeFile: (path: string, content: string) => void;
  readonly mkdir: (path: string) => void;
  readonly cwd: string;
};

type ContractsCheckOptions = {
  readonly controllers: string;
  readonly json: boolean;
  readonly out: string | null;
  readonly strictSchemas: boolean;
};

type ContractsCheckParseResult =
  | { readonly kind: "help" }
  | { readonly kind: "invalid"; readonly message: string }
  | { readonly kind: "run"; readonly options: ContractsCheckOptions };

function createDefaultIo(): ContractsCheckIo {
  const runtime = getCrocoCommandRuntime();
  return {
    stdout: runtime.stdout,
    stderr: runtime.stderr,
    writeFile: (path, content) => writeFileSync(path, content),
    mkdir: (path) => mkdirSync(path, { recursive: true }),
    cwd: runtime.cwd,
  };
}

export const contractsCheck = defineCommand({
  meta: {
    name: "check",
    description: "Validate and snapshot the canonical contract graph",
  },
  args: CHECK_OPTIONS,
  async run({ rawArgs }) {
    getCrocoCommandRuntime().setExitCode(await runContractsCheck(rawArgs));
  },
});

export async function runContractsCheck(
  args: readonly string[],
  options: {
    readonly loadContractGraph?: ContractGraphLoader;
    readonly io?: Partial<ContractsCheckIo>;
  } = {},
): Promise<number> {
  const parsed = parseContractsCheckArgs(args);
  const io = { ...createDefaultIo(), ...options.io };

  if (parsed.kind === "help") {
    printContractsCheckHelp(io);
    return 0;
  }

  if (parsed.kind === "invalid") {
    io.stderr(parsed.message);
    printContractsCheckHelp(io);
    return 1;
  }

  const loadContractGraph = options.loadContractGraph ?? loadContractGraphFromRpcCodegen;
  const graph = await loadContractGraph(parsed.options.controllers, {
    strictSchemas: parsed.options.strictSchemas,
  });
  const snapshot = createContractGraphSnapshot(graph);
  const snapshotJson = stringifyContractGraphSnapshot(snapshot);

  if (parsed.options.json) {
    if (parsed.options.out) {
      writeOutputFile(parsed.options.out, snapshotJson, io);
      io.stdout(`Wrote contract graph snapshot to ${resolvePath(parsed.options.out, io.cwd)}.`);
    } else {
      io.stdout(snapshotJson.trimEnd());
    }
  } else {
    reportContractDiagnostics(graph, io);
  }

  const errors = getContractGraphErrors(graph);

  if (errors.length > 0) {
    if (!parsed.options.json) {
      io.stdout(`Contract graph check failed with ${errors.length} error(s).`);
    }

    return 1;
  }

  if (!parsed.options.json) {
    io.stdout(
      `Contract graph check passed for ${graph.routes.length} route(s) across ${graph.controllers.length} controller(s).`,
    );
  }

  return 0;
}

export function parseContractsCheckArgs(args: readonly string[]): ContractsCheckParseResult {
  if (args.includes("--help") || args.includes("-h")) {
    return { kind: "help" };
  }

  try {
    const { values, positionals, tokens } = parseArgs({
      args: [...args],
      options: CHECK_OPTIONS,
      allowPositionals: true,
      strict: true,
      tokens: true,
    });

    // Validate every path option and keep the first value, as in the original parser.
    let controllers: string | undefined;
    let out: string | undefined;
    for (const token of tokens) {
      if (token.kind !== "option" || token.value === undefined) continue;
      if (token.value === "") {
        return { kind: "invalid", message: `Option ${token.rawName} requires a nonempty value.` };
      }
      if (token.name === "controllers") controllers ??= token.value;
      if (token.name === "out") out ??= token.value;
    }

    const extra = positionals[controllers === undefined ? 1 : 0];
    if (extra !== undefined) {
      return { kind: "invalid", message: `Unexpected positional argument '${extra}'.` };
    }

    controllers ??= positionals[0];
    if (!controllers) {
      return {
        kind: "invalid",
        message:
          "Missing controller glob. Pass --controllers <glob> or a positional controller glob.",
      };
    }

    return {
      kind: "run",
      options: {
        controllers,
        out: out ?? null,
        json: values.json === true || out !== undefined,
        strictSchemas: values["strict-schemas"] === true,
      },
    };
  } catch (error) {
    return {
      kind: "invalid",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

function printContractsCheckHelp(io: ContractsCheckIo): void {
  io.stdout(`Usage: croco contracts check --controllers <glob> [--strict-schemas] [--json] [--out <path>]
       croco contracts check <glob> [--strict-schemas] [--json] [--out <path>]

Options:
  --controllers <glob>  ${CHECK_OPTIONS.controllers.description}
  --json                ${CHECK_OPTIONS.json.description}
  --out <path>          ${CHECK_OPTIONS.out.description}
  --strict-schemas      ${CHECK_OPTIONS["strict-schemas"].description}
  --help, -h            Show this help message`);
}

function reportContractDiagnostics(graph: ContractGraph, io: ContractsCheckIo): void {
  for (const diagnostic of graph.diagnostics) {
    io.stdout(formatContractDiagnostic(diagnostic));
  }
}

async function loadContractGraphFromRpcCodegen(
  glob: string,
  options: BuildContractGraphOptions,
): Promise<ContractGraph> {
  const { loadContractGraph } = await import("@croco/rpc-codegen");

  return loadContractGraph(glob, options);
}

function writeOutputFile(path: string, content: string, io: ContractsCheckIo): void {
  const resolvedPath = resolvePath(path, io.cwd);
  io.mkdir(dirname(resolvedPath));
  io.writeFile(resolvedPath, content);
}

function resolvePath(path: string, cwd: string): string {
  return resolve(cwd, path);
}
