import { readFileSync } from "node:fs";
import { isAbsolute, resolve, win32 } from "node:path";
import { defineCommand } from "citty";
import {
  checkArchitecturePolicy,
  formatArchitecturePolicyDiagnostic,
  parseArchitecturePolicyManifest,
} from "@croco/architecture-policy";
import { GLOBAL_OPTIONS } from "./options.js";
import type { ArchitecturePolicyReport } from "@croco/architecture-policy";

export type ArchitecturePolicyCheckIo = {
  readonly stdout: (message: string) => void;
  readonly stderr: (message: string) => void;
  readonly readFile: (path: string) => string;
  readonly cwd: string;
};

type ArchitecturePolicyCheckOptions = {
  readonly manifest: string;
  readonly root: string | null;
  readonly json: boolean;
};

type ArchitecturePolicyCheckParseResult =
  | { readonly kind: "help" }
  | { readonly kind: "invalid"; readonly message: string }
  | { readonly kind: "run"; readonly options: ArchitecturePolicyCheckOptions };

const defaultIo: ArchitecturePolicyCheckIo = {
  stdout: (message) => console.log(message),
  stderr: (message) => console.error(message),
  readFile: (path) => readFileSync(path, "utf-8"),
  cwd: process.cwd(),
};

export const architecturePolicyCheck = defineCommand({
  meta: {
    name: "check",
    description: "Validate static architecture policy manifests",
  },
  args: {
    ...GLOBAL_OPTIONS,
  },
  async run({ rawArgs }) {
    process.exitCode = await runArchitecturePolicyCheck(rawArgs);
  },
});

export const architecturePolicy = defineCommand({
  meta: {
    name: "architecture-policy",
    description: "Validate static architecture policy manifests",
  },
  subCommands: {
    check: architecturePolicyCheck,
  },
});

export async function runArchitecturePolicyCheck(
  args: readonly string[],
  options: {
    readonly io?: Partial<ArchitecturePolicyCheckIo>;
  } = {},
): Promise<number> {
  const parsed = parseArchitecturePolicyCheckArgs(args);
  const io = { ...defaultIo, ...options.io };

  if (parsed.kind === "help") {
    printArchitecturePolicyCheckHelp(io);
    return 0;
  }

  if (parsed.kind === "invalid") {
    io.stderr(parsed.message);
    printArchitecturePolicyCheckHelp(io);
    return 1;
  }

  try {
    const manifestPath = resolvePath(parsed.options.manifest, io.cwd);
    const rootDir = resolvePath(parsed.options.root ?? ".", io.cwd);
    const manifest = parseArchitecturePolicyManifest(io.readFile(manifestPath));
    const report = checkArchitecturePolicy({ rootDir, manifest });

    if (parsed.options.json) {
      printJsonReport(io, report);
    } else if (report.diagnostics.length > 0) {
      for (const diagnostic of report.diagnostics) {
        io.stdout(formatArchitecturePolicyDiagnostic(diagnostic));
        if (diagnostic.recovery) {
          io.stdout(`  action: ${diagnostic.recovery}`);
        }
        io.stdout(`  evidence: ${diagnostic.excerpt}`);
      }
      io.stdout(`Architecture policy check failed with ${report.diagnostics.length} error(s).`);
    } else {
      io.stdout(
        `Architecture policy check passed for ${report.importCount} import(s) across ${report.packageCount} package(s).`,
      );
    }

    return report.status === "pass" ? 0 : 1;
  } catch (error) {
    io.stderr(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

export function parseArchitecturePolicyCheckArgs(
  args: readonly string[],
): ArchitecturePolicyCheckParseResult {
  if (args.includes("--help") || args.includes("-h")) {
    return { kind: "help" };
  }

  const consumedIndexes = getConsumedArgumentIndexes(args);
  const manifest = getFlagValue(args, "--manifest");
  const root = getFlagValue(args, "--root");
  const positionalManifest = getFirstPosition(args, consumedIndexes);
  const selectedManifest = manifest ?? positionalManifest;

  if (!selectedManifest) {
    return {
      kind: "invalid",
      message: "Missing architecture policy manifest. Pass --manifest <path>.",
    };
  }

  return {
    kind: "run",
    options: {
      manifest: selectedManifest,
      root,
      json: args.includes("--json"),
    },
  };
}

function printArchitecturePolicyCheckHelp(io: ArchitecturePolicyCheckIo): void {
  io.stdout(`Usage: croco architecture-policy check --manifest <croco.arch.json> [--root <dir>] [--json]
       croco architecture-policy check <croco.arch.json> [--root <dir>] [--json]

Options:
  --manifest <path> Architecture policy manifest
  --root <dir>      Repository or generated app root. Defaults to the current directory.
  --json            Print a stable JSON report
  --help, -h        Show this help message`);
}

function printJsonReport(io: ArchitecturePolicyCheckIo, report: ArchitecturePolicyReport): void {
  io.stdout(`${JSON.stringify(report, null, 2)}\n`);
}

function getFlagValue(args: readonly string[], flag: string): string | null {
  for (let index = args.length - 1; index >= 0; index -= 1) {
    if (args[index] !== flag) {
      continue;
    }

    const value = args[index + 1];
    return value && !value.startsWith("-") ? value : null;
  }

  return null;
}

function getFirstPosition(
  args: readonly string[],
  consumedIndexes = new Set<number>(),
): string | null {
  return args.find((arg, index) => !consumedIndexes.has(index) && !arg.startsWith("-")) ?? null;
}

function getConsumedArgumentIndexes(args: readonly string[]): Set<number> {
  const consumed = new Set<number>();
  const valueFlags = new Set(["--manifest", "--root"]);
  const booleanFlags = new Set(["--json"]);

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (valueFlags.has(arg)) {
      consumed.add(index);

      const value = args[index + 1];
      if (value && !value.startsWith("-")) {
        consumed.add(index + 1);
      }
      continue;
    }

    if (booleanFlags.has(arg)) {
      consumed.add(index);
    }
  }

  return consumed;
}

function resolvePath(path: string, cwd: string): string {
  return isAbsolute(path) || win32.isAbsolute(path) ? path : resolve(cwd, path);
}
