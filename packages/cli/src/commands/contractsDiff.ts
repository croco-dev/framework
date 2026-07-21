import { dirname, resolve } from "node:path";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { defineCommand } from "citty";
import {
  createContractGraphSnapshot,
  diffContractGraphSnapshots,
  formatContractDiagnostic,
  getContractGraphErrors,
  parseContractGraphSnapshot,
  type BuildContractGraphOptions,
  type ContractGraph,
  type ContractGraphDiff,
  type ContractGraphDiffChange,
  type ContractGraphSnapshot,
} from "@croco/protocols-core";
import { GLOBAL_OPTIONS } from "./options.js";

export type ContractsDiffIo = {
  readonly stdout: (message: string) => void;
  readonly stderr: (message: string) => void;
  readonly readFile: (path: string) => string;
  readonly writeFile: (path: string, content: string) => void;
  readonly mkdir: (path: string) => void;
  readonly cwd: string;
};

type ContractGraphLoader = (
  glob: string,
  options: BuildContractGraphOptions,
) => Promise<ContractGraph>;

type ContractsDiffOptions = {
  readonly baseline: string;
  readonly controllers: string;
  readonly json: boolean;
  readonly out: string | null;
  readonly strictSchemas: boolean;
};

type ContractsDiffParseResult =
  | { readonly kind: "help" }
  | { readonly kind: "invalid"; readonly message: string }
  | { readonly kind: "run"; readonly options: ContractsDiffOptions };

const defaultIo: ContractsDiffIo = {
  stdout: (message) => console.log(message),
  stderr: (message) => console.error(message),
  readFile: (path) => readFileSync(path, "utf8"),
  writeFile: (path, content) => writeFileSync(path, content),
  mkdir: (path) => mkdirSync(path, { recursive: true }),
  cwd: process.cwd(),
};

export const contractsDiff = defineCommand({
  meta: {
    name: "diff",
    description: "Compare a ContractGraph snapshot with current controller metadata",
  },
  args: {
    ...GLOBAL_OPTIONS,
  },
  async run({ rawArgs }) {
    process.exitCode = await runContractsDiff(rawArgs);
  },
});

export async function runContractsDiff(
  args: readonly string[],
  options: {
    readonly loadContractGraph?: ContractGraphLoader;
    readonly io?: Partial<ContractsDiffIo>;
  } = {},
): Promise<number> {
  const parsed = parseContractsDiffArgs(args);
  const io = { ...defaultIo, ...options.io };

  if (parsed.kind === "help") {
    printContractsDiffHelp(io);
    return 0;
  }

  if (parsed.kind === "invalid") {
    io.stderr(parsed.message);
    printContractsDiffHelp(io);
    return 1;
  }

  const baseline = readSnapshot(parsed.options.baseline, io);
  const loadContractGraph = options.loadContractGraph ?? loadContractGraphFromRpcCodegen;
  const graph = await loadContractGraph(parsed.options.controllers, {
    strictSchemas: parsed.options.strictSchemas,
  });
  const errors = getContractGraphErrors(graph);

  if (errors.length > 0) {
    reportCurrentGraphErrors(errors, parsed.options.json, io);
    return 1;
  }

  const current = createContractGraphSnapshot(graph);
  const diff = diffContractGraphSnapshots(baseline, current);
  const diffJson = `${JSON.stringify(diff, null, 2)}\n`;

  if (parsed.options.json) {
    if (parsed.options.out) {
      writeOutputFile(parsed.options.out, diffJson, io);
      io.stdout(`Wrote contract graph diff to ${resolvePath(parsed.options.out, io.cwd)}.`);
    } else {
      io.stdout(diffJson.trimEnd());
    }
  } else {
    reportContractDiff(diff, io);
  }

  return diff.hasBreakingChanges ? 1 : 0;
}

export function parseContractsDiffArgs(args: readonly string[]): ContractsDiffParseResult {
  if (args.includes("--help") || args.includes("-h")) {
    return { kind: "help" };
  }

  const baseline = getFlagValue(args, "--baseline");
  const controllers = getFlagValue(args, "--controllers") ?? getFirstPosition(args);
  const out = getFlagValue(args, "--out");

  if (!baseline) {
    return {
      kind: "invalid",
      message: "Missing baseline snapshot. Pass --baseline <path>.",
    };
  }

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
      baseline,
      controllers,
      out,
      json: args.includes("--json") || out !== null,
      strictSchemas: args.includes("--strict-schemas"),
    },
  };
}

function printContractsDiffHelp(io: ContractsDiffIo): void {
  io.stdout(`Usage: croco contracts diff --baseline <snapshot.json> --controllers <glob> [--json] [--out <path>]

Options:
  --baseline <path>     Stable ContractGraph snapshot JSON to compare against
  --controllers <glob>  Current controller files to load
  --json                Print a machine-readable diff report
  --out <path>          Write the diff report JSON to a file
  --strict-schemas      Fail when generated routes omit response, body, or named parameter schemas
  --help, -h            Show this help message`);
}

function reportCurrentGraphErrors(
  errors: ReturnType<typeof getContractGraphErrors>,
  json: boolean,
  io: ContractsDiffIo,
): void {
  const output = json ? io.stderr : io.stdout;

  for (const diagnostic of errors) {
    output(formatContractDiagnostic(diagnostic));
  }

  output(`Contract graph diff failed with ${errors.length} current graph error(s).`);
}

function reportContractDiff(diff: ContractGraphDiff, io: ContractsDiffIo): void {
  for (const change of diff.changes) {
    io.stdout(formatChange(change));
  }

  if (diff.changes.length === 0) {
    io.stdout(
      `Contract graph diff passed with no changes (${diff.currentRouteCount} current route(s)).`,
    );
    return;
  }

  const summary = `Contract graph diff found ${diff.breakingChangeCount} breaking change(s) and ${diff.nonBreakingChangeCount} non-breaking change(s).`;

  if (diff.hasBreakingChanges) {
    io.stdout(`${summary} Breaking contract drift must be reviewed before release.`);
    return;
  }

  io.stdout(summary);
}

function formatChange(change: ContractGraphDiffChange): string {
  const identity = change.routeId ?? change.controllerName ?? change.operationId ?? "graph";

  return `${change.severity.toUpperCase()} ${change.code} ${identity}: ${change.message}`;
}

function readSnapshot(path: string, io: ContractsDiffIo): ContractGraphSnapshot {
  const snapshot = parseContractGraphSnapshot(JSON.parse(io.readFile(resolvePath(path, io.cwd))));

  if (!snapshot) {
    throw new Error(`${path} is not a croco.contract-graph.snapshot.v1 JSON snapshot.`);
  }

  return snapshot;
}

async function loadContractGraphFromRpcCodegen(
  glob: string,
  options: BuildContractGraphOptions,
): Promise<ContractGraph> {
  const { loadContractGraph } = await import("@croco/rpc-codegen");

  return loadContractGraph(glob, options);
}

function writeOutputFile(path: string, content: string, io: ContractsDiffIo): void {
  const resolvedPath = resolvePath(path, io.cwd);
  io.mkdir(dirname(resolvedPath));
  io.writeFile(resolvedPath, content);
}

function resolvePath(path: string, cwd: string): string {
  return resolve(cwd, path);
}

function getFlagValue(args: readonly string[], flag: string): string | null {
  const index = args.indexOf(flag);
  const value = index >= 0 ? args[index + 1] : undefined;

  return value && !value.startsWith("--") ? value : null;
}

function getFirstPosition(args: readonly string[]): string | null {
  const valueFlags = new Set(["--baseline", "--controllers", "--out"]);

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (!arg) {
      continue;
    }

    if (valueFlags.has(arg)) {
      index += 1;
      continue;
    }

    if (!arg.startsWith("-")) {
      return arg;
    }
  }

  return null;
}
