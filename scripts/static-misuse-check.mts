#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

export type StaticMisuseDiagnostic = {
  readonly code: string;
  readonly ruleId: string;
  readonly file: string;
  readonly line: number;
  readonly column: number;
  readonly message: string;
  readonly excerpt: string;
  readonly action: string;
};

export type StaticMisuseRuleResult = {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly targetDir: string;
  readonly status: "pass" | "fail" | "missing-target";
  readonly description: string;
  readonly limitation: string;
  readonly recovery: string;
  readonly diagnostics: readonly StaticMisuseDiagnostic[];
};

type StaticMisuseRule = {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly targetDir: string;
  readonly description: string;
  readonly limitation: string;
  readonly recovery: string;
  readonly detectors: readonly LineDetector[];
  readonly syntaxDetectors?: readonly SyntaxDetector[];
  readonly includeFile?: (relativeFile: string) => boolean;
  readonly allowlistPath?: string;
  readonly allowInlineIgnore?: boolean;
};

type LineDetector = {
  readonly match: (line: string) => RegExpMatchArray | null;
  readonly message: string;
  readonly action: string;
};

type SyntaxDetectorContext = {
  readonly rule: StaticMisuseRule;
  readonly relativeFile: string;
  readonly lines: readonly string[];
  readonly sourceFile: ts.SourceFile;
};

type SyntaxDetector = {
  readonly detect: (context: SyntaxDetectorContext) => readonly StaticMisuseDiagnostic[];
};

type StaticMisuseAllowlistEntry = {
  readonly package: string;
  readonly file: string;
  readonly line: number;
  readonly excerpt: string;
  readonly reason: string;
  readonly owner?: string;
  readonly expiresOn?: string;
};

type LoadedStaticMisuseAllowlist = {
  readonly entries: readonly StaticMisuseAllowlistEntry[];
  readonly diagnostics: readonly StaticMisuseDiagnostic[];
};

type StaticMisuseAllowlistEntryValidation =
  | { readonly ok: true; readonly entry: StaticMisuseAllowlistEntry }
  | { readonly ok: false; readonly reason: string };

type CheckOptions = {
  readonly rootDir: string;
};

const sourceFilePattern = /\.[cm]?[jt]sx?$/;
const ignoreLinePrefix = "croco-static-misuse-ignore-line";
const ignoreNextLinePrefix = "croco-static-misuse-ignore-next-line";

const repositoryBoundaryRule: StaticMisuseRule = {
  id: "repository-core-implementation-boundary",
  code: "CROCO_STATIC_REPOSITORY_CORE_IMPLEMENTATION_BOUNDARY",
  title: "@croco/repository-core must stay adapter agnostic",
  targetDir: "packages/repository-core/src",
  description:
    "@croco/repository-core is the repository interface layer; Drizzle ORM and tx-drizzle implementation details belong in @croco/tx-drizzle.",
  limitation:
    "This first-pass checker is intentionally import-oriented. It catches direct implementation imports in repository-core source files; indirect type aliases and generated manifests need dedicated future rules.",
  recovery:
    "Move Drizzle-specific repository code to @croco/tx-drizzle and keep @croco/repository-core limited to adapter-agnostic interfaces.",
  detectors: [
    {
      match: (line) => matchImportSpecifier(line, /drizzle-orm(?:\/[^'"]*)?/),
      message: "@croco/repository-core cannot import drizzle-orm directly.",
      action:
        "Move Drizzle ORM integration code to @croco/tx-drizzle and expose only adapter-neutral repository contracts from repository-core.",
    },
    {
      match: (line) => matchImportSpecifier(line, /@croco\/tx-drizzle(?:\/[^'"]*)?/),
      message: "@croco/repository-core cannot import @croco/tx-drizzle.",
      action:
        "Move Drizzle repository implementations to @croco/tx-drizzle; repository-core should define only shared interfaces and Problems.",
    },
    {
      match: (line) => {
        if (!line.includes("Drizzle")) {
          return null;
        }
        return matchImportSpecifier(line, /@croco\/tx-core(?:\/[^'"]*)?/);
      },
      message: "@croco/repository-core cannot depend on Drizzle-shaped tx-core types.",
      action:
        "Keep repository-core transaction contracts implementation-neutral, or move Drizzle-specific transaction typing to @croco/tx-drizzle.",
    },
  ],
};

const restGeneratedContractRule: StaticMisuseRule = {
  id: "rest-generated-contract-schema-boundary",
  code: "CROCO_STATIC_REST_GENERATED_CONTRACT_SCHEMA_BOUNDARY",
  title: "Generated REST contracts must declare concrete route schemas",
  targetDir: "packages/create-croco-app/templates",
  description:
    "Generated app templates are contract-first surfaces. Their REST routes must use concrete HTTP methods and schema-backed body and named parameter decorators so RPC/OpenAPI generation fails before runtime.",
  limitation:
    "This first-pass checker is line-oriented and scoped to generated app templates. Compatibility-mode application code and multiline decorator calls remain covered by ContractGraph, RPC codegen, and OpenAPI diagnostics.",
  recovery:
    "Use explicit HTTP method decorators and pass Zod schemas to @Body(...), @Param(name, ...), @Query(name, ...), and @Header(name, ...) in generated contract routes.",
  detectors: [
    {
      match: (line) => line.match(/@All\s*\(/),
      message: "@All cannot be used in generated REST contract routes.",
      action:
        "Replace @All with explicit HTTP method decorators such as @Get, @Post, @Put, @Patch, or @Delete so generated clients and OpenAPI can emit concrete operations.",
    },
    {
      match: (line) => line.match(/@Body\s*\(\s*\)/),
      message: "@Body() in generated REST contract routes must include a schema.",
      action:
        "Pass the route contract body schema to @Body(schema) so generated clients and OpenAPI can validate the request body contract.",
    },
    {
      match: (line) => matchSchemaLessNamedParamDecorator(line),
      message: "Named REST parameter decorators in generated contract routes must include schemas.",
      action:
        'Pass a Zod schema as the second decorator argument, for example @Param("id", idSchema) or @Query("limit", limitSchema).',
    },
  ],
};

const rawErrorRuntimeBoundaryRule: StaticMisuseRule = {
  id: "raw-error-runtime-boundary",
  code: "CROCO_STATIC_RAW_ERROR_RUNTIME_BOUNDARY",
  title: "Production package runtime boundaries must not throw raw built-in Errors",
  targetDir: "packages",
  description:
    "Croco runtime package failures should expose Problem-shaped failures or stable diagnostic-coded package errors instead of raw built-in Error subclasses.",
  limitation:
    "This first-pass checker is line-oriented and scoped to production packages/*/src files. Multiline throw expressions and generated output snapshots need dedicated future rules.",
  recovery:
    "Throw a Croco Problem subclass or a package-specific diagnostic-coded error class. If the throw is a reviewed internal programmer assertion, add it to scripts/static-misuse-raw-error-allowlist.json with package, file, reason, and owner or expiration.",
  includeFile: isProductionPackageSourceFile,
  allowlistPath: "scripts/static-misuse-raw-error-allowlist.json",
  detectors: [
    {
      match: (line) =>
        line.match(
          /\bthrow\s+(?:new\s+)?(Error|TypeError|RangeError|ReferenceError|SyntaxError|EvalError|URIError|AggregateError)\s*\(/,
        ),
      message:
        "Production package source cannot throw raw built-in Error subclasses at runtime boundaries.",
      action:
        "Use a Problem subclass or package-specific diagnostic-coded error class, or record a reviewed internal exception in the static misuse raw-error allowlist.",
    },
  ],
};

const emptyCatchRuntimeBoundaryRule: StaticMisuseRule = {
  id: "empty-catch-runtime-boundary",
  code: "CROCO_STATIC_EMPTY_CATCH_RUNTIME_BOUNDARY",
  title: "Production package runtime catches must preserve reviewed failure evidence",
  targetDir: "packages",
  description:
    "Croco runtime package source must not silently swallow failures in empty catch blocks. Intentional best-effort recovery needs a reviewed baseline entry with owner or expiration metadata.",
  limitation:
    "This syntax-aware checker is scoped to production packages/*/src source files. It flags catch clauses whose block has no executable statements, including comments-only catch blocks.",
  recovery:
    "Handle the failure explicitly with Problem, diagnostic, telemetry, logging, or recovery behavior. If the catch is intentionally best-effort, add it to scripts/static-misuse-empty-catch-allowlist.json with package, file, reason, and owner or expiration.",
  detectors: [],
  syntaxDetectors: [
    {
      detect: detectEmptyCatchClauses,
    },
  ],
  includeFile: isProductionPackageSourceFile,
  allowlistPath: "scripts/static-misuse-empty-catch-allowlist.json",
  allowInlineIgnore: false,
};

const STATIC_MISUSE_RULES: readonly StaticMisuseRule[] = [
  repositoryBoundaryRule,
  restGeneratedContractRule,
  rawErrorRuntimeBoundaryRule,
  emptyCatchRuntimeBoundaryRule,
];

function matchImportSpecifier(line: string, specifierPattern: RegExp): RegExpMatchArray | null {
  return line.match(
    new RegExp(
      String.raw`(?:from\s+|import\s*\(\s*|require\s*\(\s*)['"]${specifierPattern.source}['"]`,
    ),
  );
}

function matchSchemaLessNamedParamDecorator(line: string): RegExpMatchArray | null {
  return line.match(/@(Param|Query|Header)\s*\(\s*(['"`])[^'"`]+\2\s*\)/);
}

function detectEmptyCatchClauses({
  lines,
  relativeFile,
  rule,
  sourceFile,
}: SyntaxDetectorContext): readonly StaticMisuseDiagnostic[] {
  const diagnostics: StaticMisuseDiagnostic[] = [];

  function visit(node: ts.Node): void {
    if (ts.isCatchClause(node) && isCatchBlockEmpty(node.block)) {
      const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
      const sourceLine = lines[start.line] ?? "";
      const catchColumn = sourceLine.indexOf("catch", start.character);

      diagnostics.push({
        code: rule.code,
        ruleId: rule.id,
        file: relativeFile,
        line: start.line + 1,
        column: (catchColumn === -1 ? start.character : catchColumn) + 1,
        message:
          "Production package source cannot use an empty catch block without reviewed failure evidence.",
        excerpt: sourceLine.trim(),
        action:
          "Handle the failure explicitly, or record a reviewed empty-catch allowlist entry with package, file, reason, and owner or expiration.",
      });
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return diagnostics;
}

function isCatchBlockEmpty(block: ts.Block): boolean {
  return block.statements.every((statement) => ts.isEmptyStatement(statement));
}

function getScriptKind(relativeFile: string): ts.ScriptKind {
  if (relativeFile.endsWith(".tsx")) {
    return ts.ScriptKind.TSX;
  }

  if (relativeFile.endsWith(".jsx")) {
    return ts.ScriptKind.JSX;
  }

  if (
    relativeFile.endsWith(".js") ||
    relativeFile.endsWith(".cjs") ||
    relativeFile.endsWith(".mjs")
  ) {
    return ts.ScriptKind.JS;
  }

  return ts.ScriptKind.TS;
}

function isProductionPackageSourceFile(relativeFile: string): boolean {
  const parts = toPosixPath(relativeFile).split("/");

  return (
    parts[0] === "packages" &&
    parts.length >= 4 &&
    parts[2] === "src" &&
    !parts.includes("tests") &&
    !relativeFile.endsWith(".spec.js") &&
    !relativeFile.endsWith(".test.js") &&
    !relativeFile.endsWith(".spec.jsx") &&
    !relativeFile.endsWith(".test.jsx") &&
    !relativeFile.endsWith(".spec.ts") &&
    !relativeFile.endsWith(".test.ts") &&
    !relativeFile.endsWith(".spec.tsx") &&
    !relativeFile.endsWith(".test.tsx")
  );
}

function stripLineComment(line: string): string {
  return line.replace(/\/\/.*$/, "");
}

function isIndexInsideStringLiteral(line: string, index: number): boolean {
  let quote: string | null = null;
  let escaped = false;

  for (let currentIndex = 0; currentIndex < index; currentIndex += 1) {
    const char = line[currentIndex];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (quote !== null) {
      if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      quote = char;
    }
  }

  return quote !== null;
}

function toPosixPath(path: string): string {
  return path.split("\\").join("/");
}

function walkSourceFiles(dir: string, results: string[] = []): string[] {
  if (!existsSync(dir)) {
    return results;
  }

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      if (
        entry.name === "node_modules" ||
        entry.name === "dist" ||
        entry.name === "coverage" ||
        entry.name === ".turbo"
      ) {
        continue;
      }
      walkSourceFiles(fullPath, results);
      continue;
    }

    if (entry.isFile() && sourceFilePattern.test(entry.name)) {
      results.push(fullPath);
    }
  }

  return results.sort();
}

function readIgnoreCodes(line: string, prefix: string): readonly string[] | null {
  const prefixIndex = line.indexOf(prefix);
  if (prefixIndex === -1) {
    return null;
  }

  const afterPrefix = line.slice(prefixIndex + prefix.length).trim();
  if (!afterPrefix || afterPrefix.startsWith("--")) {
    return ["*"];
  }

  return afterPrefix
    .split(/\s+/)
    .filter((part) => part !== "--")
    .map((part) => part.trim())
    .filter(Boolean);
}

function includesIgnoreCode(codes: readonly string[] | null, code: string): boolean {
  return codes !== null && (codes.includes("*") || codes.includes(code));
}

function isLineIgnored(lines: readonly string[], lineIndex: number, code: string): boolean {
  const lineIgnoreCodes = readIgnoreCodes(lines[lineIndex] ?? "", ignoreLinePrefix);
  if (includesIgnoreCode(lineIgnoreCodes, code)) {
    return true;
  }

  if (lineIndex === 0) {
    return false;
  }

  const previousLineIgnoreCodes = readIgnoreCodes(lines[lineIndex - 1] ?? "", ignoreNextLinePrefix);
  return includesIgnoreCode(previousLineIgnoreCodes, code);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function readPackageName(rootDir: string, relativeFile: string): string | null {
  const parts = toPosixPath(relativeFile).split("/");

  if (parts[0] !== "packages" || !parts[1]) {
    return null;
  }

  const packageJsonPath = join(rootDir, "packages", parts[1], "package.json");

  if (!existsSync(packageJsonPath)) {
    return null;
  }

  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8")) as unknown;

    if (isRecord(packageJson) && typeof packageJson.name === "string") {
      return packageJson.name;
    }
  } catch {
    return null;
  }

  return null;
}

function createAllowlistDiagnostic(
  rule: StaticMisuseRule,
  allowlistPath: string,
  message: string,
  action: string,
): StaticMisuseDiagnostic {
  return {
    code: rule.code,
    ruleId: rule.id,
    file: allowlistPath,
    line: 1,
    column: 1,
    message,
    excerpt: allowlistPath,
    action,
  };
}

function loadAllowlist(rootDir: string, rule: StaticMisuseRule): LoadedStaticMisuseAllowlist {
  const allowlistPath = rule.allowlistPath;

  if (!allowlistPath) {
    return { entries: [], diagnostics: [] };
  }

  const fullPath = join(rootDir, allowlistPath);

  if (!existsSync(fullPath)) {
    return { entries: [], diagnostics: [] };
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(readFileSync(fullPath, "utf-8")) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return {
      entries: [],
      diagnostics: [
        createAllowlistDiagnostic(
          rule,
          allowlistPath,
          `Static misuse allowlist is not valid JSON: ${message}`,
          "Fix the allowlist JSON before relying on reviewed static misuse exceptions.",
        ),
      ],
    };
  }

  if (!isRecord(parsed) || parsed.schemaVersion !== 1 || !Array.isArray(parsed.entries)) {
    return {
      entries: [],
      diagnostics: [
        createAllowlistDiagnostic(
          rule,
          allowlistPath,
          "Static misuse allowlist must use schemaVersion 1 and an entries array.",
          "Write the allowlist as { schemaVersion: 1, entries: [...] }.",
        ),
      ],
    };
  }

  const entries: StaticMisuseAllowlistEntry[] = [];
  const diagnostics: StaticMisuseDiagnostic[] = [];

  parsed.entries.forEach((entry, index) => {
    const validation = validateAllowlistEntry(rootDir, entry);

    if (isValidAllowlistEntry(validation)) {
      entries.push(validation.entry);
      return;
    }

    diagnostics.push(
      createAllowlistDiagnostic(
        rule,
        allowlistPath,
        `Static misuse allowlist entry ${index} is invalid: ${validation.reason}`,
        "Each allowlist entry must name package, file, line, excerpt, reason, and owner or expiresOn, and it must match the current source line.",
      ),
    );
  });

  return { entries, diagnostics };
}

function validateAllowlistEntry(
  rootDir: string,
  entry: unknown,
): StaticMisuseAllowlistEntryValidation {
  if (!isRecord(entry)) {
    return { ok: false, reason: "entry must be an object" };
  }

  if (!isNonEmptyString(entry.package)) {
    return { ok: false, reason: "package must be a non-empty string" };
  }

  if (!isNonEmptyString(entry.file)) {
    return { ok: false, reason: "file must be a non-empty string" };
  }

  const line = entry.line;

  if (typeof line !== "number" || !Number.isInteger(line) || line < 1) {
    return { ok: false, reason: "line must be a positive integer" };
  }

  if (!isNonEmptyString(entry.excerpt)) {
    return { ok: false, reason: "excerpt must be a non-empty string" };
  }

  if (!isNonEmptyString(entry.reason)) {
    return { ok: false, reason: "reason must be a non-empty string" };
  }

  if (!isNonEmptyString(entry.owner) && !isNonEmptyString(entry.expiresOn)) {
    return { ok: false, reason: "owner or expiresOn must be provided" };
  }

  if (entry.expiresOn !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(String(entry.expiresOn))) {
    return { ok: false, reason: "expiresOn must use YYYY-MM-DD format when provided" };
  }

  const relativeFile = toPosixPath(entry.file);

  if (!isProductionPackageSourceFile(relativeFile)) {
    return { ok: false, reason: "file must point at production packages/*/src source" };
  }

  const packageName = readPackageName(rootDir, relativeFile);

  if (packageName !== entry.package) {
    return {
      ok: false,
      reason: `package must match ${packageName ?? "the source package name"}`,
    };
  }

  const fullPath = join(rootDir, relativeFile);

  if (!existsSync(fullPath)) {
    return { ok: false, reason: "file does not exist" };
  }

  const sourceLine = readFileSync(fullPath, "utf-8").split(/\r?\n/)[line - 1]?.trim();

  if (sourceLine !== entry.excerpt) {
    return { ok: false, reason: "excerpt does not match the current source line" };
  }

  return {
    ok: true,
    entry: {
      package: entry.package,
      file: relativeFile,
      line,
      excerpt: entry.excerpt,
      reason: entry.reason,
      ...(isNonEmptyString(entry.owner) ? { owner: entry.owner } : {}),
      ...(isNonEmptyString(entry.expiresOn) ? { expiresOn: entry.expiresOn } : {}),
    },
  };
}

function isValidAllowlistEntry(
  validation: StaticMisuseAllowlistEntryValidation,
): validation is { readonly ok: true; readonly entry: StaticMisuseAllowlistEntry } {
  return validation.ok;
}

function isDiagnosticAllowlisted(
  rootDir: string,
  diagnostic: StaticMisuseDiagnostic,
  entries: readonly StaticMisuseAllowlistEntry[],
): boolean {
  const packageName = readPackageName(rootDir, diagnostic.file);

  return entries.some(
    (entry) =>
      entry.package === packageName &&
      entry.file === diagnostic.file &&
      entry.line === diagnostic.line &&
      entry.excerpt === diagnostic.excerpt,
  );
}

function scanRule(rootDir: string, rule: StaticMisuseRule): StaticMisuseRuleResult {
  const targetDir = join(rootDir, rule.targetDir);

  if (!existsSync(targetDir) || !statSync(targetDir).isDirectory()) {
    return {
      id: rule.id,
      code: rule.code,
      title: rule.title,
      targetDir: rule.targetDir,
      status: "missing-target",
      description: rule.description,
      limitation: rule.limitation,
      recovery: rule.recovery,
      diagnostics: [],
    };
  }

  const allowlist = loadAllowlist(rootDir, rule);
  const diagnostics = walkSourceFiles(targetDir).flatMap((filePath) => {
    const source = readFileSync(filePath, "utf-8");
    const lines = source.split(/\r?\n/);
    const relativeFile = toPosixPath(relative(rootDir, filePath));
    const allowInlineIgnore = rule.allowInlineIgnore ?? true;

    if (rule.includeFile && !rule.includeFile(relativeFile)) {
      return [];
    }

    const lineDiagnostics = lines.flatMap((line, lineIndex) => {
      if (allowInlineIgnore && isLineIgnored(lines, lineIndex, rule.code)) {
        return [];
      }
      const analyzableLine = stripLineComment(line);

      for (const detector of rule.detectors) {
        const match = detector.match(analyzableLine);
        if (!match) {
          continue;
        }
        if (match.index !== undefined && isIndexInsideStringLiteral(analyzableLine, match.index)) {
          continue;
        }

        const diagnostic = {
          code: rule.code,
          ruleId: rule.id,
          file: relativeFile,
          line: lineIndex + 1,
          column: match.index === undefined ? 1 : match.index + 1,
          message: detector.message,
          excerpt: line.trim(),
          action: detector.action,
        };

        if (isDiagnosticAllowlisted(rootDir, diagnostic, allowlist.entries)) {
          return [];
        }

        return [diagnostic];
      }

      return [];
    });

    const syntaxDiagnostics =
      rule.syntaxDetectors?.flatMap((detector) => {
        const sourceFile = ts.createSourceFile(
          relativeFile,
          source,
          ts.ScriptTarget.Latest,
          true,
          getScriptKind(relativeFile),
        );

        return detector.detect({
          lines,
          relativeFile,
          rule,
          sourceFile,
        });
      }) ?? [];

    return [...lineDiagnostics, ...syntaxDiagnostics].filter(
      (diagnostic) => !isDiagnosticAllowlisted(rootDir, diagnostic, allowlist.entries),
    );
  });
  const allDiagnostics = [...allowlist.diagnostics, ...diagnostics];

  return {
    id: rule.id,
    code: rule.code,
    title: rule.title,
    targetDir: rule.targetDir,
    status: allDiagnostics.length > 0 ? "fail" : "pass",
    description: rule.description,
    limitation: rule.limitation,
    recovery: rule.recovery,
    diagnostics: allDiagnostics,
  };
}

export function runStaticMisuseChecks(rootDir: string): StaticMisuseRuleResult[] {
  return STATIC_MISUSE_RULES.map((rule) => scanRule(rootDir, rule));
}

function parseArgs(args: readonly string[]): CheckOptions {
  let rootDir = process.cwd();

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];

    if (arg === "--root") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("--root requires a path");
      }
      rootDir = resolve(value);
      index++;
      continue;
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  return {
    rootDir,
  };
}

function printTextReport(results: readonly StaticMisuseRuleResult[]): void {
  for (const result of results) {
    const rule = STATIC_MISUSE_RULES.find((candidate) => candidate.code === result.code);

    console.log(`static-misuse: ${result.code} ${result.status}`);

    if (result.status === "missing-target") {
      console.error(`- target directory missing: ${result.targetDir}`);
      console.error(`  action: ${result.recovery}`);
      continue;
    }

    for (const diagnostic of result.diagnostics) {
      console.error(
        `- ${diagnostic.file}:${diagnostic.line}:${diagnostic.column}: ${diagnostic.code}: ${diagnostic.message}`,
      );
      console.error(`  evidence: ${diagnostic.excerpt}`);
      console.error(`  action: ${diagnostic.action}`);
    }

    if (result.diagnostics.length > 0) {
      console.error(`  limitation: ${result.limitation}`);
      if (rule && rule.allowInlineIgnore === false && rule.allowlistPath) {
        console.error(`  reviewed baseline: ${rule.allowlistPath}`);
      } else {
        console.error(
          `  escape hatch: // ${ignoreNextLinePrefix} ${result.code} -- explain why this direct reference is intentional`,
        );
      }
    }
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const results = runStaticMisuseChecks(options.rootDir);
  const failureCount = results.filter((result) => result.status !== "pass").length;
  const diagnosticCount = results.reduce((count, result) => count + result.diagnostics.length, 0);

  printTextReport(results);

  if (failureCount > 0) {
    console.error(`static-misuse: ${diagnosticCount} diagnostic(s) across ${failureCount} rule(s)`);
    process.exit(1);
  }

  console.log("static-misuse: all rules passed");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`static-misuse: failed: ${message}`);
    process.exit(1);
  });
}
