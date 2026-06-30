import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { defineCommand } from "citty";
import { GLOBAL_OPTIONS } from "./options.js";

export type UpgradeFindingConfidence = "safe" | "manual";
export type UpgradeFindingAction = "rewrite" | "confirm";
export type UpgradeReportMode = "dry-run" | "write";

export type UpgradeSourceLocation = {
  readonly file: string;
  readonly line: number;
  readonly column: number;
};

export type UpgradeFinding = {
  readonly code: string;
  readonly ruleId: string;
  readonly title: string;
  readonly confidence: UpgradeFindingConfidence;
  readonly action: UpgradeFindingAction;
  readonly message: string;
  readonly location: UpgradeSourceLocation;
  readonly applied: boolean;
  readonly diff?: string;
};

export type UpgradeReport = {
  readonly version: "croco.upgrade.report.v1";
  readonly cwd: string;
  readonly mode: UpgradeReportMode;
  readonly summary: {
    readonly filesScanned: number;
    readonly findings: number;
    readonly safeCodemods: number;
    readonly manualConfirmations: number;
    readonly appliedCodemods: number;
  };
  readonly findings: readonly UpgradeFinding[];
};

export type UpgradeIo = {
  readonly stdout: (message: string) => void;
  readonly stderr: (message: string) => void;
  readonly readFile: (path: string) => string;
  readonly writeFile: (path: string, content: string) => void;
  readonly mkdir: (path: string) => void;
  readonly exists: (path: string) => boolean;
  readonly stat: (path: string) => {
    readonly isDirectory: () => boolean;
    readonly isFile: () => boolean;
  };
  readonly readDir: (path: string) => readonly UpgradeDirent[];
  readonly cwd: string;
};

export type UpgradeDirent = {
  readonly name: string;
  readonly isDirectory: () => boolean;
  readonly isFile: () => boolean;
};

type UpgradeOptions = {
  readonly cwd: string;
  readonly targets: readonly string[];
  readonly mode: UpgradeReportMode;
  readonly json: boolean;
};

type UpgradeParseResult =
  | { readonly kind: "help" }
  | { readonly kind: "invalid"; readonly message: string }
  | { readonly kind: "run"; readonly options: UpgradeOptions };

type TextReplacement = {
  readonly start: number;
  readonly end: number;
  readonly text: string;
};

type FileAnalysis = {
  readonly findings: readonly FileFinding[];
  readonly updatedContent: string;
};

type FileFinding = Omit<UpgradeFinding, "location" | "applied" | "diff"> & {
  readonly index: number;
  readonly suggestedReplacement?: TextReplacement;
};

const UPGRADE_REPORT_VERSION = "croco.upgrade.report.v1";
const SOURCE_EXTENSIONS = /\.(?:c|m)?(?:t|j)sx?$/;
const SKIPPED_DIRECTORIES = new Set([
  ".git",
  ".turbo",
  ".croco",
  "coverage",
  "dist",
  "node_modules",
]);
const VALUE_FLAGS = new Set(["--cwd"]);

const UPGRADE_FINDING_CODES = {
  metaViteRouteConfig: "CROCO_CLI_UPGRADE_001",
  unsupportedRouteConfig: "CROCO_CLI_UPGRADE_002",
  legacyHttpSecurityCode: "CROCO_CLI_UPGRADE_003",
  unsafeSecurityValidation: "CROCO_CLI_UPGRADE_004",
  legacyHttpSecurityCompatibilityString: "CROCO_CLI_UPGRADE_005",
} as const;

const defaultIo: UpgradeIo = {
  stdout: (message) => console.log(message),
  stderr: (message) => console.error(message),
  readFile: (path) => readFileSync(path, "utf-8"),
  writeFile: (path, content) => writeFileSync(path, content),
  mkdir: (path) => mkdirSync(path, { recursive: true }),
  exists: (path) => existsSync(path),
  stat: (path) => statSync(path),
  readDir: (path) => readdirSync(path, { withFileTypes: true }),
  cwd: process.cwd(),
};

export const upgrade = defineCommand({
  meta: {
    name: "upgrade",
    description: "Report and apply safe Croco version migration codemods",
  },
  args: {
    ...GLOBAL_OPTIONS,
  },
  async run({ rawArgs }) {
    process.exitCode = await runUpgrade(rawArgs);
  },
});

export async function runUpgrade(
  args: readonly string[],
  options: {
    readonly io?: Partial<UpgradeIo>;
  } = {},
): Promise<number> {
  const io = { ...defaultIo, ...options.io };
  const parsed = parseUpgradeArgs(args, io.cwd);

  if (parsed.kind === "help") {
    printUpgradeHelp(io);
    return 0;
  }

  if (parsed.kind === "invalid") {
    io.stderr(parsed.message);
    printUpgradeHelp(io);
    return 1;
  }

  try {
    const report = createUpgradeReport(parsed.options, io);

    if (parsed.options.json) {
      io.stdout(JSON.stringify(report, null, 2));
    } else {
      io.stdout(formatUpgradeReport(report));
    }

    return 0;
  } catch (error) {
    io.stderr(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

export function parseUpgradeArgs(
  args: readonly string[],
  defaultCwd = process.cwd(),
): UpgradeParseResult {
  if (args.includes("--help") || args.includes("-h")) {
    return { kind: "help" };
  }

  const write = args.includes("--write");
  const dryRun = args.includes("--dry-run") || args.includes("--dryRun");

  if (write && dryRun) {
    return {
      kind: "invalid",
      message: "Pass either --write or --dry-run, not both.",
    };
  }

  const cwd = resolve(defaultCwd, getFlagValue(args, "--cwd") ?? ".");

  return {
    kind: "run",
    options: {
      cwd,
      mode: write ? "write" : "dry-run",
      json: args.includes("--json"),
      targets: getPositionals(args),
    },
  };
}

export function createUpgradeReport(options: UpgradeOptions, io: UpgradeIo): UpgradeReport {
  const targets = options.targets.length > 0 ? options.targets : ["."];
  const sourceFiles = collectSourceFiles(targets, options.cwd, io);
  const findings: UpgradeFinding[] = [];
  let appliedCodemods = 0;

  for (const file of sourceFiles) {
    const content = io.readFile(file);
    const analysis = analyzeUpgradeFile(content);
    const diff =
      analysis.updatedContent === content
        ? undefined
        : formatUnifiedDiff(toReportPath(file, options.cwd), content, analysis.updatedContent);

    if (options.mode === "write" && analysis.updatedContent !== content) {
      io.mkdir(dirname(file));
      io.writeFile(file, analysis.updatedContent);
    }

    for (const finding of analysis.findings) {
      const location = toLocation(content, finding.index, file, options.cwd);
      const applied = options.mode === "write" && finding.action === "rewrite";
      const findingDiff =
        finding.action === "rewrite"
          ? diff
          : finding.suggestedReplacement
            ? formatUnifiedDiff(
                toReportPath(file, options.cwd),
                content,
                applyReplacements(content, [finding.suggestedReplacement]),
              )
            : undefined;

      if (applied) {
        appliedCodemods += 1;
      }

      const { suggestedReplacement: _suggestedReplacement, ...reportFinding } = finding;

      findings.push({
        ...reportFinding,
        location,
        applied,
        ...(findingDiff ? { diff: findingDiff } : {}),
      });
    }
  }

  const safeCodemods = findings.filter((finding) => finding.action === "rewrite").length;
  const manualConfirmations = findings.filter((finding) => finding.action === "confirm").length;

  return {
    version: UPGRADE_REPORT_VERSION,
    cwd: options.cwd,
    mode: options.mode,
    summary: {
      filesScanned: sourceFiles.length,
      findings: findings.length,
      safeCodemods,
      manualConfirmations,
      appliedCodemods,
    },
    findings,
  };
}

export function analyzeUpgradeFile(content: string): FileAnalysis {
  const replacements: TextReplacement[] = [];
  const findings: FileFinding[] = [];
  const routeMigration = findMetaViteRouteConfigMigration(content);

  if (routeMigration) {
    findings.push({
      code: UPGRADE_FINDING_CODES.metaViteRouteConfig,
      ruleId: "meta-vite-route-config",
      title: "Legacy SPA routeConfig has a meta-vite migration suggestion",
      confidence: "manual",
      action: "confirm",
      message:
        "Generated SPA routeConfig shape matched the known Croco template, but changing route runtime semantics requires confirmation before rewriting it to @croco/meta-vite defineRoute output.",
      index: routeMigration.index,
      suggestedReplacement: routeMigration.replacement,
    });
  } else {
    const unsupportedRouteConfig = content.search(/\bexport\s+const\s+routeConfig\b/);

    if (unsupportedRouteConfig >= 0) {
      findings.push({
        code: UPGRADE_FINDING_CODES.unsupportedRouteConfig,
        ruleId: "unsupported-route-config",
        title: "Route config requires manual migration",
        confidence: "manual",
        action: "confirm",
        message:
          "routeConfig was found, but its shape does not match the generated Croco SPA template. Review the route contract before rewriting it.",
        index: unsupportedRouteConfig,
      });
    }
  }

  const legacySecurityCodeMatches = findLegacyHttpSecurityCodeMatches(content);

  if (legacySecurityCodeMatches.length > 0) {
    const safeMatches = legacySecurityCodeMatches.filter((match) => match.safe);
    const manualMatches = legacySecurityCodeMatches.filter((match) => !match.safe);

    for (const match of safeMatches) {
      replacements.push({
        start: match.index,
        end: match.index + match.text.length,
        text: `${match.quote}CROCO_HTTP_SECURITY_001${match.quote}`,
      });
    }

    if (safeMatches.length > 0) {
      findings.push({
        code: UPGRADE_FINDING_CODES.legacyHttpSecurityCode,
        ruleId: "legacy-http-security-diagnostic-code",
        title: "Legacy HTTP security diagnostic code can migrate",
        confidence: "safe",
        action: "rewrite",
        message:
          "Problem.code matchers for transports-http/security-middleware-validation can be rewritten to CROCO_HTTP_SECURITY_001 while legacyCode remains available for rollout compatibility.",
        index: safeMatches[0]?.index ?? 0,
      });
    }

    for (const match of manualMatches) {
      findings.push({
        code: UPGRADE_FINDING_CODES.legacyHttpSecurityCompatibilityString,
        ruleId: "legacy-http-security-compatibility-string",
        title: "Legacy HTTP security compatibility string needs confirmation",
        confidence: "manual",
        action: "confirm",
        message:
          "A transports-http/security-middleware-validation string was found outside a Problem.code matcher. The migration assistant leaves it unchanged because legacyCode compatibility, fixtures, and documentation references can intentionally keep the legacy value.",
        index: match.index,
      });
    }
  }

  const unsafeSecurityValidation = content.search(
    /\b(?:unsafeSkipSecurityValidation\s*:\s*true|securityValidation\s*:\s*(['"])off\1)/,
  );

  if (unsafeSecurityValidation >= 0) {
    findings.push({
      code: UPGRADE_FINDING_CODES.unsafeSecurityValidation,
      ruleId: "unsafe-security-validation",
      title: "Security validation opt-out needs confirmation",
      confidence: "manual",
      action: "confirm",
      message:
        "Security validation is disabled. The migration assistant leaves this unchanged because production intent, middleware coverage, and local fixture scope must be confirmed first.",
      index: unsafeSecurityValidation,
    });
  }

  return {
    findings,
    updatedContent: applyReplacements(content, replacements),
  };
}

type LegacyHttpSecurityCodeMatch = {
  readonly index: number;
  readonly text: string;
  readonly quote: string;
  readonly safe: boolean;
};

function findLegacyHttpSecurityCodeMatches(
  content: string,
): readonly LegacyHttpSecurityCodeMatch[] {
  return [...content.matchAll(/(['"])transports-http\/security-middleware-validation\1/g)].flatMap(
    (match) => {
      if (typeof match.index !== "number") {
        return [];
      }

      return [
        {
          index: match.index,
          text: match[0],
          quote: match[1] ?? "'",
          safe: isProblemCodeComparison(content, match.index, match[0].length),
        },
      ];
    },
  );
}

function isProblemCodeComparison(content: string, index: number, length: number): boolean {
  const lineStart = content.lastIndexOf("\n", index - 1) + 1;
  const lineEndIndex = content.indexOf("\n", index + length);
  const lineEnd = lineEndIndex >= 0 ? lineEndIndex : content.length;
  const before = content.slice(lineStart, index);
  const after = content.slice(index + length, lineEnd);
  const codeAccess = String.raw`(?:^|[^A-Za-z0-9_$])(?:[A-Za-z_$][\w$]*(?:\??\.[A-Za-z_$][\w$]*)*\??\.)?code`;
  const codeBeforeLiteral = new RegExp(`${codeAccess}\\s*(?:===|!==|==|!=)\\s*$`);
  const codeAfterLiteral = new RegExp(
    `^\\s*(?:===|!==|==|!=)\\s*(?:[A-Za-z_$][\\w$]*(?:\\??\\.[A-Za-z_$][\\w$]*)*\\??\\.)?code(?:[^A-Za-z0-9_$]|$)`,
  );

  return codeBeforeLiteral.test(before) || codeAfterLiteral.test(after);
}

export function formatUpgradeReport(report: UpgradeReport): string {
  const modeLabel = report.mode === "write" ? "write" : "dry-run";
  const lines = [
    `Croco upgrade assistant ${modeLabel} scanned ${report.summary.filesScanned} file(s) and found ${report.summary.findings} finding(s).`,
    `Safe codemods: ${report.summary.safeCodemods}; manual confirmations: ${report.summary.manualConfirmations}; applied codemods: ${report.summary.appliedCodemods}.`,
  ];

  if (report.findings.length === 0) {
    lines.push("No Croco migrations found.");
    return lines.join("\n");
  }

  for (const finding of report.findings) {
    lines.push("");
    lines.push(
      `${finding.confidence.toUpperCase()} ${finding.code} ${finding.location.file}:${finding.location.line}:${finding.location.column}`,
    );
    lines.push(`${finding.title}: ${finding.message}`);

    if (finding.action === "rewrite") {
      lines.push(
        finding.applied ? "Status: applied." : "Status: pending; rerun with --write to apply.",
      );
    } else {
      lines.push("Status: confirmation required; no rewrite was applied.");
    }

    if (finding.diff) {
      lines.push(finding.diff);
    }
  }

  if (report.mode === "dry-run" && report.summary.safeCodemods > 0) {
    lines.push("");
    lines.push("Run with --write to apply safe codemods. Manual confirmations stay reported only.");
  }

  return lines.join("\n");
}

function printUpgradeHelp(io: UpgradeIo): void {
  io.stdout(`Usage: croco upgrade [paths...] [--write] [--json] [--cwd <path>]

Options:
  --write       Apply safe codemods. Defaults to dry-run.
  --dry-run     Preview migrations without writing files.
  --json        Print a machine-readable upgrade report.
  --cwd <path>  Workspace directory used for relative paths.
  --help, -h    Show this help message`);
}

function collectSourceFiles(targets: readonly string[], cwd: string, io: UpgradeIo): string[] {
  const files = new Set<string>();

  for (const target of targets) {
    collectSourceFilesFromPath(resolve(cwd, target), io, files);
  }

  return [...files].sort(compareStrings);
}

function collectSourceFilesFromPath(path: string, io: UpgradeIo, files: Set<string>): void {
  if (!io.exists(path)) {
    throw new Error(`Upgrade target '${path}' does not exist.`);
  }

  const stat = io.stat(path);

  if (stat.isFile()) {
    if (SOURCE_EXTENSIONS.test(path)) {
      files.add(path);
    }

    return;
  }

  if (!stat.isDirectory()) {
    return;
  }

  for (const entry of io.readDir(path)) {
    if (entry.isDirectory() && SKIPPED_DIRECTORIES.has(entry.name)) {
      continue;
    }

    collectSourceFilesFromPath(resolve(path, entry.name), io, files);
  }
}

function findMetaViteRouteConfigMigration(
  content: string,
): { readonly index: number; readonly replacement: TextReplacement } | null {
  const routeConfigPattern =
    /import\s+([A-Za-z_$][\w$]*)\s+from\s+(['"])\.\/Page\2;\s*\n\s*export\s+const\s+routeConfig\s*=\s*\{\s*\n\s*path:\s*(['"])([^'"]+)\3,\s*\n\s*Component:\s*([A-Za-z_$][\w$]*),\s*\n\s*\};/m;
  const match = routeConfigPattern.exec(content);
  const componentName = match?.[1];
  const routePath = match?.[4];
  const componentRef = match?.[5];

  if (!match || !componentName || !routePath || componentName !== componentRef) {
    return null;
  }

  const replacementText = `import { defineRoute, type PageRouteDefinition } from '@croco/meta-vite';
import ${componentName} from './Page';

const route = {
  path: '${routePath}',
  mode: 'ssr',
  component: ${componentName},
} satisfies PageRouteDefinition;

export default defineRoute(route);`;

  return {
    index: match.index,
    replacement: {
      start: match.index,
      end: match.index + match[0].length,
      text: replacementText,
    },
  };
}

function applyReplacements(content: string, replacements: readonly TextReplacement[]): string {
  if (replacements.length === 0) {
    return content;
  }

  const ordered = [...replacements].sort((first, second) => first.start - second.start);

  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1];
    const current = ordered[index];

    if (previous && current && previous.end > current.start) {
      throw new Error("Upgrade codemod replacements overlap.");
    }
  }

  let updated = content;

  for (const replacement of ordered.reverse()) {
    updated = `${updated.slice(0, replacement.start)}${replacement.text}${updated.slice(replacement.end)}`;
  }

  return updated;
}

function formatUnifiedDiff(path: string, before: string, after: string): string {
  const beforeLines = splitLines(before);
  const afterLines = splitLines(after);
  let prefix = 0;

  while (
    prefix < beforeLines.length &&
    prefix < afterLines.length &&
    beforeLines[prefix] === afterLines[prefix]
  ) {
    prefix += 1;
  }

  let suffix = 0;

  while (
    suffix + prefix < beforeLines.length &&
    suffix + prefix < afterLines.length &&
    beforeLines[beforeLines.length - 1 - suffix] === afterLines[afterLines.length - 1 - suffix]
  ) {
    suffix += 1;
  }

  const removed = beforeLines.slice(prefix, beforeLines.length - suffix);
  const added = afterLines.slice(prefix, afterLines.length - suffix);
  const contextBefore = beforeLines.slice(Math.max(0, prefix - 2), prefix);
  const contextAfter = beforeLines.slice(
    beforeLines.length - suffix,
    beforeLines.length - suffix + 2,
  );
  const startLine = Math.max(1, prefix - contextBefore.length + 1);
  const lines = [`--- before/${path}`, `+++ after/${path}`, `@@ line ${startLine} @@`];

  for (const line of contextBefore) {
    lines.push(` ${line}`);
  }

  for (const line of removed) {
    lines.push(`-${line}`);
  }

  for (const line of added) {
    lines.push(`+${line}`);
  }

  for (const line of contextAfter) {
    lines.push(` ${line}`);
  }

  return lines.join("\n");
}

function splitLines(value: string): string[] {
  const withoutFinalNewline = value.endsWith("\n") ? value.slice(0, -1) : value;

  return withoutFinalNewline.length === 0 ? [] : withoutFinalNewline.split("\n");
}

function toLocation(
  content: string,
  index: number,
  file: string,
  cwd: string,
): UpgradeSourceLocation {
  const location = lineColumnAt(content, index);

  return {
    file: toReportPath(file, cwd),
    ...location,
  };
}

function lineColumnAt(
  content: string,
  index: number,
): { readonly line: number; readonly column: number } {
  const prefix = content.slice(0, index);
  const lines = prefix.split("\n");

  return {
    line: lines.length,
    column: (lines.at(-1)?.length ?? 0) + 1,
  };
}

function toReportPath(path: string, cwd: string): string {
  const reportPath = relative(cwd, path);

  return reportPath.startsWith("..") ? path : reportPath.split(sep).join("/");
}

function getFlagValue(args: readonly string[], flag: string): string | null {
  const index = args.indexOf(flag);
  const value = index >= 0 ? args[index + 1] : undefined;

  return value && !value.startsWith("--") ? value : null;
}

function getPositionals(args: readonly string[]): readonly string[] {
  const positionals: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (!arg) {
      continue;
    }

    if (VALUE_FLAGS.has(arg)) {
      index += 1;
      continue;
    }

    if (!arg.startsWith("-")) {
      positionals.push(arg);
    }
  }

  return positionals;
}

function compareStrings(first: string, second: string): number {
  return first.localeCompare(second);
}
