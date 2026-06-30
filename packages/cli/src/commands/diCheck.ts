import { dirname, resolve } from "node:path";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { defineCommand } from "citty";
import {
  CLI_DIAGNOSTIC_CODES,
  CLI_LEGACY_DIAGNOSTIC_CODES,
  getStableCliDiagnosticCodeForLegacyCode,
} from "../libs/diagnosticCodes.js";
import { GLOBAL_OPTIONS } from "./options.js";

type DiCheckStatus = "passed" | "failed";

export type DiCheckDiagnostic = {
  readonly code: string;
  readonly legacyCode?: string;
  readonly severity: "error" | "warning";
  readonly message: string;
  readonly token?: string;
  readonly moduleName?: string;
  readonly path?: readonly string[];
  readonly sourceLocation?: {
    readonly file: string;
    readonly line?: number;
    readonly column?: number;
  };
};

export type DiCheckReport = {
  readonly version: "croco.di-check.report.v1";
  readonly manifestVersion: string;
  readonly status: DiCheckStatus;
  readonly diagnostics: readonly DiCheckDiagnostic[];
};

export type DiCheckIo = {
  readonly stdout: (message: string) => void;
  readonly stderr: (message: string) => void;
  readonly readFile: (path: string) => string;
  readonly writeFile: (path: string, content: string) => void;
  readonly mkdir: (path: string) => void;
  readonly cwd: string;
};

type DiCheckOptions = {
  readonly manifest: string;
  readonly json: boolean;
  readonly out: string | null;
};

type DiCheckParseResult =
  | { readonly kind: "help" }
  | { readonly kind: "invalid"; readonly message: string }
  | { readonly kind: "run"; readonly options: DiCheckOptions };

const defaultIo: DiCheckIo = {
  stdout: (message) => console.log(message),
  stderr: (message) => console.error(message),
  readFile: (path) => readFileSync(path, "utf-8"),
  writeFile: (path, content) => writeFileSync(path, content),
  mkdir: (path) => mkdirSync(path, { recursive: true }),
  cwd: process.cwd(),
};

export const diCheck = defineCommand({
  meta: {
    name: "check",
    description: "Validate a Croco DI or module graph manifest",
  },
  args: {
    ...GLOBAL_OPTIONS,
  },
  async run({ rawArgs }) {
    process.exitCode = await runDiCheck(rawArgs);
  },
});

export async function runDiCheck(
  args: readonly string[],
  options: { readonly io?: Partial<DiCheckIo> } = {},
): Promise<number> {
  const parsed = parseDiCheckArgs(args);
  const io = { ...defaultIo, ...options.io };

  if (parsed.kind === "help") {
    printDiCheckHelp(io);
    return 0;
  }

  if (parsed.kind === "invalid") {
    io.stderr(parsed.message);
    printDiCheckHelp(io);
    return 1;
  }

  const manifestPath = resolvePath(parsed.options.manifest, io.cwd);
  const report = createDiCheckReport(readJsonManifest(manifestPath, io));
  const reportJson = `${JSON.stringify(report, null, 2)}\n`;

  if (parsed.options.json) {
    if (parsed.options.out) {
      writeOutputFile(parsed.options.out, reportJson, io);
      io.stdout(`Wrote DI graph check report to ${resolvePath(parsed.options.out, io.cwd)}.`);
    } else {
      io.stdout(reportJson.trimEnd());
    }
  } else {
    reportDiDiagnostics(report, io);
  }

  return report.status === "passed" ? 0 : 1;
}

export function parseDiCheckArgs(args: readonly string[]): DiCheckParseResult {
  if (args.includes("--help") || args.includes("-h")) {
    return { kind: "help" };
  }

  const manifest = getFlagValue(args, "--manifest") ?? getFirstPosition(args);
  const out = getFlagValue(args, "--out");

  if (!manifest) {
    return {
      kind: "invalid",
      message: "Missing DI graph manifest. Pass --manifest <path> or a positional manifest path.",
    };
  }

  return {
    kind: "run",
    options: {
      manifest,
      out,
      json: args.includes("--json") || out !== null,
    },
  };
}

function readJsonManifest(path: string, io: DiCheckIo): unknown {
  try {
    return JSON.parse(io.readFile(path)) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      version: "unknown",
      status: "failed",
      diagnostics: [
        {
          code: CLI_DIAGNOSTIC_CODES.diCheckManifestInvalid,
          legacyCode: CLI_LEGACY_DIAGNOSTIC_CODES.diCheckManifestInvalid,
          severity: "error",
          message: `Unable to read DI graph manifest '${path}': ${message}`,
        },
      ],
    };
  }
}

function createDiCheckReport(manifest: unknown): DiCheckReport {
  const manifestRecord = asRecord(manifest);
  const manifestVersion =
    typeof manifestRecord?.version === "string" ? manifestRecord.version : "unknown";
  const diagnostics = readManifestDiagnostics(manifestRecord);
  const manifestStatus = manifestRecord?.status;

  if (manifestStatus === "failed" && diagnostics.length === 0) {
    diagnostics.push({
      code: CLI_DIAGNOSTIC_CODES.diCheckManifestFailed,
      legacyCode: CLI_LEGACY_DIAGNOSTIC_CODES.diCheckManifestFailed,
      severity: "error",
      message: "DI graph manifest is failed but does not include diagnostics.",
    });
  }

  return {
    version: "croco.di-check.report.v1",
    manifestVersion,
    status: diagnostics.some((diagnostic) => diagnostic.severity === "error") ? "failed" : "passed",
    diagnostics,
  };
}

function readManifestDiagnostics(
  manifest: Readonly<Record<string, unknown>> | null,
): DiCheckDiagnostic[] {
  if (!manifest) {
    return [
      {
        code: CLI_DIAGNOSTIC_CODES.diCheckManifestInvalid,
        legacyCode: CLI_LEGACY_DIAGNOSTIC_CODES.diCheckManifestInvalid,
        severity: "error",
        message: "DI graph manifest must be a JSON object.",
      },
    ];
  }

  const diagnostics = manifest.diagnostics;
  if (!Array.isArray(diagnostics)) {
    return [];
  }

  return diagnostics.map(normalizeDiagnostic);
}

function normalizeDiagnostic(value: unknown): DiCheckDiagnostic {
  const record = asRecord(value);
  const sourceLocation = asSourceLocation(record?.sourceLocation);
  const path = Array.isArray(record?.path)
    ? record.path.filter((entry): entry is string => typeof entry === "string")
    : undefined;
  const token = readOptionalString(record, "token");
  const moduleName = readOptionalString(record, "moduleName");
  const rawCode = readOptionalString(record, "code");
  const rawLegacyCode = readOptionalString(record, "legacyCode");
  const stableCode = rawCode ? getStableCliDiagnosticCodeForLegacyCode(rawCode) : undefined;
  const isUnmappedCliLegacyCode = rawCode !== undefined && isCliLegacyDiagnosticCode(rawCode);
  const code =
    stableCode ??
    (isUnmappedCliLegacyCode ? CLI_DIAGNOSTIC_CODES.diCheckDiagnosticUnknown : rawCode) ??
    CLI_DIAGNOSTIC_CODES.diCheckDiagnosticUnknown;
  const legacyCode =
    (isUnmappedCliLegacyCode ? rawCode : rawLegacyCode) ??
    (stableCode && rawCode ? rawCode : undefined) ??
    (code === CLI_DIAGNOSTIC_CODES.diCheckDiagnosticUnknown
      ? CLI_LEGACY_DIAGNOSTIC_CODES.diCheckDiagnosticUnknown
      : undefined);

  return {
    code,
    ...(legacyCode ? { legacyCode } : {}),
    severity: readSeverity(record?.severity),
    message: readString(record, "message", "DI graph manifest reported an error."),
    ...(token ? { token } : {}),
    ...(moduleName ? { moduleName } : {}),
    ...(path && path.length > 0 ? { path } : {}),
    ...(sourceLocation ? { sourceLocation } : {}),
  };
}

const CLI_LEGACY_DIAGNOSTIC_PREFIXES = [
  "cli/",
  "di-check/",
  "doctor/",
  "jobs/",
  "ops/",
  "project-map/",
  "usage-dashboard/",
] as const;

function isCliLegacyDiagnosticCode(code: string): boolean {
  return CLI_LEGACY_DIAGNOSTIC_PREFIXES.some((prefix) => code.startsWith(prefix));
}

function asSourceLocation(value: unknown): DiCheckDiagnostic["sourceLocation"] | undefined {
  const record = asRecord(value);
  if (!record || typeof record.file !== "string") {
    return undefined;
  }

  return {
    file: record.file,
    ...(typeof record.line === "number" ? { line: record.line } : {}),
    ...(typeof record.column === "number" ? { column: record.column } : {}),
  };
}

function reportDiDiagnostics(report: DiCheckReport, io: DiCheckIo): void {
  for (const diagnostic of report.diagnostics) {
    io.stdout(formatDiDiagnostic(diagnostic));
  }

  if (report.status === "passed") {
    io.stdout(`DI graph check passed for ${report.manifestVersion}.`);
    return;
  }

  io.stdout(
    `DI graph check failed for ${report.manifestVersion} with ${report.diagnostics.length} diagnostic(s).`,
  );
}

function formatDiDiagnostic(diagnostic: DiCheckDiagnostic): string {
  const location = formatSourceLocation(diagnostic.sourceLocation);
  const token = diagnostic.token ? ` token=${diagnostic.token}` : "";
  const moduleName = diagnostic.moduleName ? ` module=${diagnostic.moduleName}` : "";
  return `${diagnostic.code}${token}${moduleName}${location}: ${diagnostic.message}`;
}

function formatSourceLocation(sourceLocation: DiCheckDiagnostic["sourceLocation"]): string {
  if (!sourceLocation) {
    return "";
  }

  const line = sourceLocation.line === undefined ? "" : `:${sourceLocation.line}`;
  const column = sourceLocation.column === undefined ? "" : `:${sourceLocation.column}`;
  return ` ${sourceLocation.file}${line}${column}`;
}

function printDiCheckHelp(io: DiCheckIo): void {
  io.stdout(`Usage: croco di check --manifest <path> [--json] [--out <path>]
       croco di check <path> [--json] [--out <path>]

Options:
  --manifest <path>  DI or module graph manifest JSON to validate
  --json             Print a machine-readable DI check report
  --out <path>       Write the machine-readable DI check report
  --help, -h         Show this help message`);
}

function writeOutputFile(path: string, content: string, io: DiCheckIo): void {
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
  const valueFlags = new Set(["--manifest", "--out"]);

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

function asRecord(value: unknown): Readonly<Record<string, unknown>> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function readString(
  record: Readonly<Record<string, unknown>> | null,
  key: string,
  fallback: string,
): string {
  const value = record?.[key];
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function readOptionalString(
  record: Readonly<Record<string, unknown>> | null,
  key: string,
): string | undefined {
  const value = record?.[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readSeverity(value: unknown): "error" | "warning" {
  return value === "warning" ? "warning" : "error";
}
