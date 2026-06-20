import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineCommand } from "citty";
import {
  checkPolicyTableRuntimeCapabilities,
  defineRuntimePolicyPreset,
  formatPolicyCapabilityDiagnostic,
  isKnownRuntimePlatform,
  RUNTIME_CAPABILITY_NAMES,
  type PolicySource,
  type PolicyTable,
  type RuntimeCapabilityName,
  type RuntimeCapabilityOverridesFor,
  type RuntimePlatform,
  type RuntimePolicyPresetConfig,
} from "@croco/framework-context";
import { GLOBAL_OPTIONS } from "./options.js";

export type RuntimePolicyCheckIo = {
  readonly stdout: (message: string) => void;
  readonly stderr: (message: string) => void;
  readonly readFile: (path: string) => string;
  readonly cwd: string;
};

type RuntimePolicyCheckOptions = {
  readonly manifest: string;
  readonly target: RuntimePlatform | null;
  readonly json: boolean;
};

type RuntimePolicyCheckParseResult =
  | { readonly kind: "help" }
  | { readonly kind: "invalid"; readonly message: string }
  | { readonly kind: "run"; readonly options: RuntimePolicyCheckOptions };

type RuntimePolicyCheckManifest = {
  readonly version?: string;
  readonly target?: RuntimePlatform;
  readonly runtime?: {
    readonly platform?: RuntimePlatform;
    readonly capabilities?: Partial<Record<RuntimeCapabilityName, boolean>>;
    readonly source?: PolicySource;
  };
  readonly table?: PolicyTable;
  readonly plans?: PolicyTable["plans"];
};

const defaultIo: RuntimePolicyCheckIo = {
  stdout: (message) => console.log(message),
  stderr: (message) => console.error(message),
  readFile: (path) => readFileSync(path, "utf-8"),
  cwd: process.cwd(),
};

export const runtimePolicyCheck = defineCommand({
  meta: {
    name: "check",
    description: "Validate RuntimePolicy requirements against a target runtime",
  },
  args: {
    ...GLOBAL_OPTIONS,
  },
  async run({ rawArgs }) {
    process.exitCode = await runRuntimePolicyCheck(rawArgs);
  },
});

export const runtimePolicy = defineCommand({
  meta: {
    name: "runtime-policy",
    description: "Validate runtime policy capability manifests",
  },
  subCommands: {
    check: runtimePolicyCheck,
  },
});

export async function runRuntimePolicyCheck(
  args: readonly string[],
  options: {
    readonly io?: Partial<RuntimePolicyCheckIo>;
  } = {},
): Promise<number> {
  const parsed = parseRuntimePolicyCheckArgs(args);
  const io = { ...defaultIo, ...options.io };

  if (parsed.kind === "help") {
    printRuntimePolicyCheckHelp(io);
    return 0;
  }

  if (parsed.kind === "invalid") {
    io.stderr(parsed.message);
    printRuntimePolicyCheckHelp(io);
    return 1;
  }

  try {
    const manifestPath = resolvePath(parsed.options.manifest, io.cwd);
    const manifest = parseManifest(io.readFile(manifestPath), manifestPath);
    const table = getManifestPolicyTable(manifest);
    const target = parsed.options.target ?? manifest.runtime?.platform ?? manifest.target;

    if (!target) {
      io.stderr("Missing target runtime. Pass --target <platform> or set runtime.platform.");
      return 1;
    }

    if (!isKnownRuntimePlatform(target)) {
      io.stderr(`Unsupported target runtime '${target}'.`);
      return 1;
    }

    const preset = defineRuntimePolicyPreset({
      platform: target,
      capabilities: manifest.runtime?.capabilities as RuntimeCapabilityOverridesFor<typeof target>,
      source: manifest.runtime?.source,
    } as RuntimePolicyPresetConfig<typeof target>);
    const diagnostics = checkPolicyTableRuntimeCapabilities(table, preset);

    if (parsed.options.json) {
      io.stdout(
        `${JSON.stringify(
          {
            status: diagnostics.length > 0 ? "fail" : "pass",
            target,
            planCount: table.plans.length,
            diagnostics,
          },
          null,
          2,
        )}\n`,
      );
    } else if (diagnostics.length > 0) {
      for (const diagnostic of diagnostics) {
        io.stdout(formatPolicyCapabilityDiagnostic(diagnostic));
      }
      io.stdout(`Runtime policy check failed with ${diagnostics.length} error(s).`);
    } else {
      io.stdout(
        `Runtime policy check passed for ${table.plans.length} plan(s) against target '${target}'.`,
      );
    }

    return diagnostics.length > 0 ? 1 : 0;
  } catch (error) {
    io.stderr(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

export function parseRuntimePolicyCheckArgs(
  args: readonly string[],
): RuntimePolicyCheckParseResult {
  if (args.includes("--help") || args.includes("-h")) {
    return { kind: "help" };
  }

  const manifest = getFlagValue(args, "--manifest") ?? getFirstPosition(args);
  const target = getFlagValue(args, "--target");

  if (!manifest) {
    return {
      kind: "invalid",
      message: "Missing runtime policy manifest. Pass --manifest <path>.",
    };
  }

  return {
    kind: "run",
    options: {
      manifest,
      target,
      json: args.includes("--json"),
    },
  };
}

function printRuntimePolicyCheckHelp(io: RuntimePolicyCheckIo): void {
  io.stdout(`Usage: croco runtime-policy check --manifest <policy-table.json> --target <platform> [--json]
       croco runtime-policy check <policy-table.json> --target <platform> [--json]

Options:
  --manifest <path>  Runtime policy manifest containing a compiled PolicyTable
  --target <platform> Target runtime platform: node, lambda, or cloudflare-workers
  --json             Print a stable JSON report
  --help, -h         Show this help message`);
}

function parseManifest(content: string, manifestPath: string): RuntimePolicyCheckManifest {
  const parsed = JSON.parse(content) as unknown;

  if (!isRecord(parsed)) {
    throw new Error(`Runtime policy manifest at ${manifestPath} must be a JSON object.`);
  }

  return {
    version: readOptionalString(parsed.version),
    target: readOptionalString(parsed.target),
    runtime: readRuntimeConfig(parsed.runtime),
    table: readPolicyTable(parsed.table),
    plans: readPolicyPlans(parsed.plans),
  };
}

function getManifestPolicyTable(manifest: RuntimePolicyCheckManifest): PolicyTable {
  if (manifest.table) {
    return manifest.table;
  }

  if (manifest.plans) {
    return { plans: manifest.plans };
  }

  throw new Error("Runtime policy manifest must contain table.plans or plans.");
}

function readRuntimeConfig(value: unknown): RuntimePolicyCheckManifest["runtime"] {
  if (!isRecord(value)) {
    return undefined;
  }

  return {
    platform: readOptionalString(value.platform),
    capabilities: readCapabilities(value.capabilities),
    source: readPolicySource(value.source),
  };
}

function readPolicyTable(value: unknown): PolicyTable | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const plans = readPolicyPlans(value.plans);
  return plans ? { plans } : undefined;
}

function readPolicyPlans(value: unknown): PolicyTable["plans"] | undefined {
  return Array.isArray(value) ? (value as PolicyTable["plans"]) : undefined;
}

function readCapabilities(
  value: unknown,
): Partial<Record<RuntimeCapabilityName, boolean>> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const capabilities: Partial<Record<RuntimeCapabilityName, boolean>> = {};

  for (const capability of RUNTIME_CAPABILITY_NAMES) {
    const capabilityValue = value[capability];

    if (typeof capabilityValue === "boolean") {
      capabilities[capability] = capabilityValue;
    }
  }

  return capabilities;
}

function readPolicySource(value: unknown): PolicySource | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  return {
    packageName: readOptionalString(value.packageName),
    file: readOptionalString(value.file),
    symbol: readOptionalString(value.symbol),
    decorator: readOptionalString(value.decorator),
  };
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
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
  const valueFlags = new Set(["--manifest", "--target"]);

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
