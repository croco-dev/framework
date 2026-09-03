#!/usr/bin/env node

import * as ts from "typescript";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { argv, exit, stdout } from "node:process";
import { fileURLToPath } from "node:url";

type Mode = "check" | "write";

type Options = {
  readonly mode: Mode;
  readonly rootDir: string;
};

type MarkdownFenceMode = "typecheck" | "no-check" | "unmarked";

type MarkdownCodeBlock = {
  readonly code: string;
  readonly file: string;
  readonly language: "ts" | "tsx" | "typescript";
  readonly mode: MarkdownFenceMode;
  readonly openingLine: number;
  readonly typeScriptBlockIndex: number;
};

type BaselineEntry = {
  readonly blockIndex: number;
  readonly file: string;
  readonly language: "ts" | "tsx" | "typescript";
  readonly openingLine: number;
  readonly reason: string;
};

type Baseline = {
  readonly entries: readonly BaselineEntry[];
};

const baselinePath = join("docs", "doc-examples-baseline.json");
const defaultSkippedReason =
  "Legacy authored docs block is not yet isolated for documentation typechecking.";
const docsRoots = [
  "README.md",
  "docs",
  join("packages", "docs", "src", "content", "docs", "en", "guides"),
  join("packages", "docs", "src", "content", "docs", "en", "reference"),
  join("packages", "docs", "src", "content", "docs", "ko"),
] as const;
const operationalEnvironmentSourceRoots = [
  join("packages", "cli", "src"),
  join("packages", "framework-context", "src"),
  join("packages", "telemetry-sdk-node", "src"),
  join("packages", "transports-http", "src"),
] as const;
const operationalEnvironmentSourceExcludedDirectories = new Set([
  "fixtures",
  "tests",
  "type-fixtures",
]);
const publicOperationalEnvironmentVariables = {
  CROCO_DEV_INSPECTOR_ENABLED: { sensitive: false },
  CROCO_DEV_INSPECTOR_EXPOSURE: { sensitive: false },
  CROCO_DEV_INSPECTOR_TOKEN: { sensitive: true },
  CROCO_DIAGNOSTICS_ENABLED: { sensitive: false },
  CROCO_DIAGNOSTICS_EXPOSURE: { sensitive: false },
  CROCO_DIAGNOSTICS_TOKEN: { sensitive: true },
  CROCO_DI_VALIDATE: { sensitive: false },
  CROCO_HTTP_DI_VALIDATION: { sensitive: false },
  CROCO_HTTP_SECURITY_VALIDATION: { sensitive: false },
  CROCO_JOBS_URL: { sensitive: false },
  NODE_ENV: { sensitive: false },
  OTEL_EXPORTER_OTLP_ENDPOINT: { sensitive: false },
  OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: { sensitive: false },
  OTEL_SAMPLING_PROBABILITY: { sensitive: false },
  OTEL_SERVICE_NAME: { sensitive: false },
  TELEMETRY_ENABLED: { sensitive: false },
} as const satisfies Record<string, { readonly sensitive: boolean }>;
const operationalEnvironmentVariableExclusions = {
  AWS_EXECUTION_ENV: "Provided by the AWS Lambda runtime rather than configured by an application.",
  AWS_LAMBDA_FUNCTION_NAME:
    "Provided by the AWS Lambda runtime rather than configured by an application.",
  ENVIRONMENT:
    "Compatibility alias for Lambda environment detection; NODE_ENV is the public setting.",
} as const satisfies Record<string, string>;
const operationalEnvironmentDocumentationRoots = [
  ...docsRoots,
  join("packages", "cli", "README.md"),
  join("packages", "telemetry-sdk-node", "README.md"),
  join("packages", "transports-http", "README.md"),
] as const;
const documentedOperationalEnvironmentVariableExclusions = {
  PUBLIC_ORIGIN: "Application-defined deployment recipe input, not a Croco runtime variable.",
  SERVICE_NAME: "Application-defined deployment recipe input, not a Croco runtime variable.",
  TRACE_SAMPLE_RATE: "Application-defined deployment recipe input, not a Croco runtime variable.",
  CROCO_STRICT_CONTRACT_RC:
    "Repository verification input for strict contract checks, not an application runtime variable.",
} as const satisfies Record<string, string>;
const nonEnvironmentCrocoDocumentationTokens = {
  CROCO_DI_: "Documented diagnostic-code namespace prefix.",
  CROCO_DOCTOR: "Documented command name.",
  CROCO_DOCTOR_: "Documented diagnostic-code namespace prefix.",
  CROCO_ROUTE: "Documented diagnostic-code namespace prefix.",
} as const satisfies Record<string, string>;
const nonEnvironmentCrocoTokenJsonRegistryPath = join("docs", "problem-code-registry.json");
const nonEnvironmentCrocoTokenSourcePaths = [
  join("packages", "cli", "src", "commands", "upgradeRules.ts"),
  join("packages", "cli", "src", "libs", "diagnosticCodes.ts"),
  join("packages", "diagnostics-core", "src", "libs", "DiagnosticCodes.ts"),
  join("packages", "meta-vite", "src", "libs", "isr", "runtimeSupport.ts"),
  join("packages", "testing", "src", "libs", "changed-test-plan.mts"),
  join("packages", "testing", "src", "libs", "executable-assurance.mts"),
  join("packages", "testing", "src", "libs", "test-evidence.mts"),
  join("scripts", "static-misuse-check.mts"),
] as const;
const diagnosticCodeMapNames = new Set(["CLI_DIAGNOSTIC_CODES", "UPGRADE_FINDING_CODES"]);
const scriptRootDir = dirname(dirname(fileURLToPath(import.meta.url)));

main();

function main(): void {
  try {
    const options = parseArgs(argv.slice(2));
    const result = run(options);

    if (result.violations.length > 0) {
      stdout.write("doc-examples-check: documentation example drift detected.\n");
      for (const violation of result.violations) {
        stdout.write(`- ${violation}\n`);
      }
      exit(1);
    }

    stdout.write(
      `doc-examples-check: checked ${result.typecheckedCount} TypeScript documentation example${result.typecheckedCount === 1 ? "" : "s"}.\n`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    stdout.write(`doc-examples-check: failed: ${message}\n`);
    exit(1);
  }
}

function run(options: Options): {
  readonly typecheckedCount: number;
  readonly violations: readonly string[];
} {
  const files = collectMarkdownFiles(options.rootDir);
  const blocks = files.flatMap((file) => extractTypeScriptBlocks(options.rootDir, file));
  const typecheckedBlocks = blocks.filter((block) => block.mode === "typecheck");
  const unmarkedBlocks = blocks.filter((block) => block.mode === "unmarked");
  const violations: string[] = [];

  if (options.mode === "write") {
    writeBaseline(options.rootDir, unmarkedBlocks);
  } else {
    violations.push(...validateBaseline(options.rootDir, unmarkedBlocks));
  }

  if (typecheckedBlocks.length === 0) {
    violations.push("no TypeScript documentation examples are marked with `typecheck`");
  }

  if (typecheckedBlocks.length > 0) {
    violations.push(...typecheckBlocks(options.rootDir, typecheckedBlocks));
  }

  violations.push(...validateRootEnvironmentTemplate(options.rootDir));

  return {
    typecheckedCount: typecheckedBlocks.length,
    violations,
  };
}

function validateRootEnvironmentTemplate(rootDir: string): string[] {
  const sourceFiles = operationalEnvironmentSourceRoots.flatMap((sourceRoot) => {
    const path = join(rootDir, sourceRoot);
    return existsSync(path) ? collectOperationalSourceFiles(path) : [];
  });

  if (sourceFiles.length === 0) {
    return [];
  }

  const templatePath = join(rootDir, ".env.example");
  if (!existsSync(templatePath)) {
    return [".env.example is required as the public operational environment variable index"];
  }

  const indexedVariables = readRootEnvironmentTemplateVariables(templatePath);
  const sourceLocations = collectOperationalEnvironmentVariableSources(rootDir, sourceFiles);
  const documentationLocations = collectDocumentedOperationalEnvironmentVariableSources(rootDir);
  const publicVariables = new Set(Object.keys(publicOperationalEnvironmentVariables));
  const knownNonEnvironmentTokens = collectKnownNonEnvironmentCrocoTokens(rootDir);
  const violations: string[] = [];
  const runtimeMissingFromTemplate = new Set<string>();

  for (const [variable, locations] of Array.from(sourceLocations.entries()).sort(
    ([left], [right]) => left.localeCompare(right),
  )) {
    if (variable in operationalEnvironmentVariableExclusions) {
      continue;
    }

    if (!publicVariables.has(variable)) {
      violations.push(
        `${variable} is read by public runtime source but missing from the operational environment policy (${locations.join(", ")})`,
      );
      continue;
    }

    if (!indexedVariables.has(variable)) {
      runtimeMissingFromTemplate.add(variable);
      violations.push(
        `${variable} is read by public runtime source but missing from .env.example (${locations.join(", ")})`,
      );
    }
  }

  for (const variable of Array.from(publicVariables).sort()) {
    if (!indexedVariables.has(variable) && !runtimeMissingFromTemplate.has(variable)) {
      violations.push(
        `${variable} is declared by the operational environment policy but missing from .env.example`,
      );
    }
  }

  for (const [variable, locations] of Array.from(documentationLocations.entries()).sort(
    ([left], [right]) => left.localeCompare(right),
  )) {
    if (
      publicVariables.has(variable) ||
      variable in documentedOperationalEnvironmentVariableExclusions ||
      knownNonEnvironmentTokens.has(variable)
    ) {
      continue;
    }

    violations.push(
      `${variable} is documented as operational configuration but missing from the operational environment policy (${locations.join(", ")})`,
    );
  }

  for (const [variable, policy] of Object.entries(publicOperationalEnvironmentVariables)) {
    if (!policy.sensitive) {
      continue;
    }

    const value = indexedVariables.get(variable);
    if (value !== undefined && value !== `<croco-secret:${variable}>`) {
      violations.push(
        `${variable} must use <croco-secret:${variable}> in .env.example, not ${value || "<empty>"}`,
      );
    }
  }

  return violations;
}

function collectOperationalSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))
    .flatMap((entry) => {
      const path = join(directory, entry.name);

      if (entry.isDirectory()) {
        return operationalEnvironmentSourceExcludedDirectories.has(entry.name)
          ? []
          : collectOperationalSourceFiles(path);
      }

      return entry.isFile() && extname(path) === ".ts" ? [path] : [];
    });
}

function readRootEnvironmentTemplateVariables(templatePath: string): ReadonlyMap<string, string> {
  const variables = new Map<string, string>();

  for (const line of readFileSync(templatePath, "utf-8").split(/\r?\n/)) {
    const match = /^\s*#?\s*(?<variable>[A-Z][A-Z0-9_]*)=(?<value>.*)$/.exec(line);
    if (match?.groups?.variable && match.groups.value !== undefined) {
      variables.set(match.groups.variable, match.groups.value.trim());
    }
  }

  return variables;
}

function collectOperationalEnvironmentVariableSources(
  rootDir: string,
  sourceFiles: readonly string[],
): ReadonlyMap<string, readonly string[]> {
  const locationsByVariable = new Map<string, Set<string>>();

  for (const sourceFile of sourceFiles) {
    const source = readFileSync(sourceFile, "utf-8");
    const parsed = ts.createSourceFile(
      sourceFile,
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    const recordVariable = (variable: string): void => {
      if (!isEnvironmentVariableName(variable)) {
        return;
      }
      const locations = locationsByVariable.get(variable) ?? new Set<string>();
      locations.add(normalizeRelativePath(rootDir, sourceFile));
      locationsByVariable.set(variable, locations);
    };

    const visit = (node: ts.Node): void => {
      if (ts.isPropertyAccessExpression(node) && isEnvironmentContainer(node.expression)) {
        recordVariable(node.name.text);
      } else if (ts.isElementAccessExpression(node) && isEnvironmentContainer(node.expression)) {
        const variable = readStaticPropertyName(node.argumentExpression);
        if (variable) {
          recordVariable(variable);
        }
      } else if (
        (ts.isVariableDeclaration(node) || ts.isParameter(node)) &&
        ts.isObjectBindingPattern(node.name) &&
        node.initializer &&
        isEnvironmentContainer(node.initializer)
      ) {
        for (const variable of readBindingPatternPropertyNames(node.name)) {
          recordVariable(variable);
        }
      } else if (
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        isEnvironmentContainer(node.right)
      ) {
        const target = unwrapExpression(node.left);
        if (ts.isObjectLiteralExpression(target)) {
          for (const property of target.properties) {
            const variable = readAssignmentPropertyName(property);
            if (variable) {
              recordVariable(variable);
            }
          }
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(parsed);
  }

  return new Map(
    Array.from(locationsByVariable.entries()).map(([variable, locations]) => [
      variable,
      Array.from(locations).sort(),
    ]),
  );
}

function isEnvironmentContainer(expression: ts.Expression): boolean {
  const value = unwrapExpression(expression);
  if (ts.isIdentifier(value)) {
    return value.text === "env";
  }

  if (!ts.isPropertyAccessExpression(value) || value.name.text !== "env") {
    return false;
  }

  if (ts.isIdentifier(value.expression) && value.expression.text === "process") {
    return true;
  }

  return (
    ts.isCallExpression(value.expression) &&
    ts.isIdentifier(value.expression.expression) &&
    value.expression.expression.text === "getCrocoCommandRuntime"
  );
}

function unwrapExpression(expression: ts.Expression): ts.Expression {
  let value = expression;
  while (
    ts.isParenthesizedExpression(value) ||
    ts.isAsExpression(value) ||
    ts.isSatisfiesExpression(value) ||
    ts.isTypeAssertionExpression(value) ||
    ts.isNonNullExpression(value)
  ) {
    value = value.expression;
  }
  return value;
}

function readStaticPropertyName(expression: ts.Expression): string | undefined {
  return ts.isStringLiteralLike(expression) ? expression.text : undefined;
}

function readBindingPatternPropertyNames(pattern: ts.ObjectBindingPattern): string[] {
  return pattern.elements.flatMap((element) => {
    const propertyName = element.propertyName ?? element.name;
    return ts.isIdentifier(propertyName) || ts.isStringLiteralLike(propertyName)
      ? [propertyName.text]
      : [];
  });
}

function readAssignmentPropertyName(property: ts.ObjectLiteralElementLike): string | undefined {
  if (ts.isShorthandPropertyAssignment(property)) {
    return property.name.text;
  }

  if (ts.isPropertyAssignment(property)) {
    const propertyName = property.name;
    return ts.isIdentifier(propertyName) || ts.isStringLiteralLike(propertyName)
      ? propertyName.text
      : undefined;
  }

  return undefined;
}

function isEnvironmentVariableName(value: string): boolean {
  return /^[A-Z][A-Z0-9_]*$/.test(value);
}

function collectDocumentedOperationalEnvironmentVariableSources(
  rootDir: string,
): ReadonlyMap<string, readonly string[]> {
  const locationsByVariable = new Map<string, Set<string>>();
  const tokenPattern =
    /\b(?:CROCO_[A-Z0-9_]+|NODE_ENV|OTEL_EXPORTER_OTLP(?:_TRACES)?_ENDPOINT|OTEL_SAMPLING_PROBABILITY|OTEL_SERVICE_NAME|PUBLIC_ORIGIN|SERVICE_NAME|TELEMETRY_ENABLED|TRACE_SAMPLE_RATE)\b/g;

  for (const file of collectMarkdownFilesFromRoots(
    rootDir,
    operationalEnvironmentDocumentationRoots,
  )) {
    const documentation = readFileSync(file, "utf-8");
    for (const match of documentation.matchAll(tokenPattern)) {
      const variable = match[0];
      const locations = locationsByVariable.get(variable) ?? new Set<string>();
      locations.add(normalizeRelativePath(rootDir, file));
      locationsByVariable.set(variable, locations);
    }
  }

  return new Map(
    Array.from(locationsByVariable.entries()).map(([variable, locations]) => [
      variable,
      Array.from(locations).sort(),
    ]),
  );
}

function collectKnownNonEnvironmentCrocoTokens(rootDir: string): ReadonlySet<string> {
  const tokens = new Set(Object.keys(nonEnvironmentCrocoDocumentationTokens));
  collectProblemRegistryCodes(rootDir, tokens);

  for (const relativePath of nonEnvironmentCrocoTokenSourcePaths) {
    const path = join(rootDir, relativePath);
    if (!existsSync(path)) {
      continue;
    }

    collectTypeScriptDiagnosticCodes(path, tokens);
  }

  return tokens;
}

function collectProblemRegistryCodes(rootDir: string, tokens: Set<string>): void {
  const path = join(rootDir, nonEnvironmentCrocoTokenJsonRegistryPath);
  if (!existsSync(path)) {
    return;
  }

  const registry = JSON.parse(readFileSync(path, "utf-8")) as unknown;
  if (!isRecord(registry) || !Array.isArray(registry.problems)) {
    return;
  }

  for (const problem of registry.problems) {
    if (isRecord(problem) && typeof problem.code === "string") {
      addCrocoToken(tokens, problem.code);
    }
  }
}

function collectTypeScriptDiagnosticCodes(path: string, tokens: Set<string>): void {
  const source = readFileSync(path, "utf-8");
  const parsed = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const visit = (node: ts.Node): void => {
    if (
      (ts.isPropertyAssignment(node) || ts.isPropertyDeclaration(node)) &&
      readNodePropertyName(node.name) === "code" &&
      node.initializer &&
      ts.isStringLiteralLike(node.initializer)
    ) {
      addCrocoToken(tokens, node.initializer.text);
    } else if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      diagnosticCodeMapNames.has(node.name.text) &&
      node.initializer
    ) {
      const initializer = unwrapExpression(node.initializer);
      if (ts.isObjectLiteralExpression(initializer)) {
        for (const property of initializer.properties) {
          if (ts.isPropertyAssignment(property) && ts.isStringLiteralLike(property.initializer)) {
            addCrocoToken(tokens, property.initializer.text);
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(parsed);
}

function readNodePropertyName(name: ts.PropertyName): string | undefined {
  return ts.isIdentifier(name) || ts.isStringLiteralLike(name) ? name.text : undefined;
}

function addCrocoToken(tokens: Set<string>, value: string): void {
  if (/^CROCO_[A-Z0-9_]+$/.test(value)) {
    tokens.add(value);
  }
}

function parseArgs(args: readonly string[]): Options {
  let mode: Mode = "check";
  let rootDir = process.cwd();

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];

    if (arg === "--check") {
      mode = "check";
      continue;
    }

    if (arg === "--write") {
      mode = "write";
      continue;
    }

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
    mode,
    rootDir,
  };
}

function collectMarkdownFiles(rootDir: string): string[] {
  return collectMarkdownFilesFromRoots(rootDir, docsRoots);
}

function collectMarkdownFilesFromRoots(rootDir: string, roots: readonly string[]): string[] {
  return Array.from(
    new Set(
      roots.flatMap((docRoot) => {
        const path = join(rootDir, docRoot);
        if (!existsSync(path)) {
          return [];
        }

        if (isMarkdownFile(path)) {
          return [path];
        }

        return collectMarkdownFilesInDirectory(path);
      }),
    ),
  ).sort((left, right) => relative(rootDir, left).localeCompare(relative(rootDir, right)));
}

function collectMarkdownFilesInDirectory(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))
    .flatMap((entry) => {
      const path = join(dir, entry.name);

      if (entry.isDirectory()) {
        return collectMarkdownFilesInDirectory(path);
      }

      if (entry.isFile() && isMarkdownFile(path)) {
        return [path];
      }

      return [];
    });
}

function isMarkdownFile(path: string): boolean {
  const extension = extname(path);
  return extension === ".md" || extension === ".mdx";
}

function extractTypeScriptBlocks(rootDir: string, filePath: string): MarkdownCodeBlock[] {
  const file = normalizeRelativePath(rootDir, filePath);
  const lines = readFileSync(filePath, "utf-8").split(/\r?\n/);
  const blocks: MarkdownCodeBlock[] = [];
  let typeScriptBlockIndex = 0;

  for (let index = 0; index < lines.length; index++) {
    const opening = parseFenceOpening(lines[index]);
    if (!opening) {
      continue;
    }

    const body: string[] = [];
    const openingLine = index + 1;
    index++;

    while (index < lines.length && !isFenceClosing(lines[index])) {
      body.push(lines[index]);
      index++;
    }

    if (!isTypeScriptLanguage(opening.language)) {
      continue;
    }

    typeScriptBlockIndex++;
    blocks.push({
      code: body.join("\n"),
      file,
      language: opening.language,
      mode: getFenceMode(opening.meta),
      openingLine,
      typeScriptBlockIndex,
    });
  }

  return blocks;
}

function parseFenceOpening(
  line: string,
): { readonly language: string; readonly meta: string } | undefined {
  const match = /^(?<indent>\s*)```(?<info>.*)$/.exec(line);
  if (!match?.groups) {
    return undefined;
  }

  const info = match.groups.info.trim();
  const [language = "", ...meta] = info.split(/\s+/);
  return {
    language: language.toLowerCase(),
    meta: meta.join(" "),
  };
}

function isFenceClosing(line: string): boolean {
  return /^\s*```\s*$/.test(line);
}

function isTypeScriptLanguage(language: string): language is "ts" | "tsx" | "typescript" {
  return language === "ts" || language === "tsx" || language === "typescript";
}

function getFenceMode(meta: string): MarkdownFenceMode {
  const normalized = meta.toLowerCase();

  if (/\b(no-check|skip-typecheck|pseudo)\b/.test(normalized)) {
    return "no-check";
  }

  if (/\b(typecheck|docs-check|doc-test)\b/.test(normalized)) {
    return "typecheck";
  }

  return "unmarked";
}

function validateBaseline(rootDir: string, unmarkedBlocks: readonly MarkdownCodeBlock[]): string[] {
  const baseline = loadBaseline(rootDir);
  const violations: string[] = [];
  const unmarkedKeys = new Set(unmarkedBlocks.map(getBlockKey));
  const baselineKeys = new Set<string>();

  for (const entry of baseline.entries) {
    const key = getBaselineEntryKey(entry);

    if (baselineKeys.has(key)) {
      violations.push(
        `${baselinePath} contains duplicate skipped block entry ${formatBaselineEntry(entry)}`,
      );
    }

    baselineKeys.add(key);

    if (entry.reason.trim().length === 0) {
      violations.push(
        `${baselinePath} skipped block entry ${formatBaselineEntry(entry)} must include a reason`,
      );
    }

    if (!unmarkedKeys.has(key)) {
      violations.push(
        `${baselinePath} has stale skipped block entry ${formatBaselineEntry(entry)}`,
      );
    }
  }

  for (const block of unmarkedBlocks) {
    if (!baselineKeys.has(getBlockKey(block))) {
      violations.push(
        `${formatBlock(block)} must be marked as \`typecheck\`, marked as \`no-check\`, or recorded in ${baselinePath}`,
      );
    }
  }

  return violations;
}

function loadBaseline(rootDir: string): Baseline {
  const path = join(rootDir, baselinePath);
  if (!existsSync(path)) {
    return { entries: [] };
  }

  const value = JSON.parse(readFileSync(path, "utf-8")) as unknown;
  if (!isRecord(value)) {
    throw new Error(`${baselinePath} must be a JSON object`);
  }

  if (value.schemaVersion !== 1) {
    throw new Error(`${baselinePath} schemaVersion must be 1`);
  }

  if (!Array.isArray(value.skippedBlocks)) {
    throw new Error(`${baselinePath} skippedBlocks must be an array`);
  }

  return {
    entries: value.skippedBlocks.map(readBaselineEntry),
  };
}

function readBaselineEntry(value: unknown, index: number): BaselineEntry {
  if (!isRecord(value)) {
    throw new Error(`${baselinePath} skippedBlocks[${index}] must be an object`);
  }

  const file = readStringField(value, "file", index);
  const blockIndex = readNumberField(value, "blockIndex", index);
  const language = readStringField(value, "language", index);
  const openingLine = readNumberField(value, "openingLine", index);
  const reason = readStringField(value, "reason", index);

  if (!isTypeScriptLanguage(language)) {
    throw new Error(
      `${baselinePath} skippedBlocks[${index}].language must be ts, tsx, or typescript`,
    );
  }

  return {
    blockIndex,
    file,
    language,
    openingLine,
    reason,
  };
}

function readStringField(value: Record<string, unknown>, field: string, index: number): string {
  const fieldValue = value[field];
  if (typeof fieldValue !== "string") {
    throw new Error(`${baselinePath} skippedBlocks[${index}].${field} must be a string`);
  }

  return fieldValue;
}

function readNumberField(value: Record<string, unknown>, field: string, index: number): number {
  const fieldValue = value[field];
  if (typeof fieldValue !== "number" || !Number.isInteger(fieldValue) || fieldValue < 1) {
    throw new Error(`${baselinePath} skippedBlocks[${index}].${field} must be a positive integer`);
  }

  return fieldValue;
}

function writeBaseline(rootDir: string, unmarkedBlocks: readonly MarkdownCodeBlock[]): void {
  const existingBaseline = loadBaseline(rootDir);
  const existingReasonByKey = new Map(
    existingBaseline.entries.map((entry) => [getBaselineEntryKey(entry), entry.reason] as const),
  );
  const skippedBlocks = unmarkedBlocks.map((block) => ({
    file: block.file,
    blockIndex: block.typeScriptBlockIndex,
    language: block.language,
    openingLine: block.openingLine,
    reason: existingReasonByKey.get(getBlockKey(block)) ?? defaultSkippedReason,
  }));
  const output = {
    schemaVersion: 1,
    skippedBlocks,
  };
  const path = join(rootDir, baselinePath);

  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(output, null, 2)}\n`);
}

function typecheckBlocks(rootDir: string, blocks: readonly MarkdownCodeBlock[]): string[] {
  const generated = generateVirtualFiles(rootDir, blocks);
  const compilerOptions = createCompilerOptions(rootDir);
  const host = createVirtualCompilerHost(compilerOptions, generated.files);
  const program = ts.createProgram({
    rootNames: Array.from(generated.files.keys()),
    options: compilerOptions,
    host,
  });

  return ts
    .getPreEmitDiagnostics(program)
    .filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error)
    .map((diagnostic) => formatDiagnostic(diagnostic, generated.blocksByFile));
}

function createCompilerOptions(rootDir: string): ts.CompilerOptions {
  const typeRoots = [
    join(rootDir, "node_modules", "@types"),
    join(scriptRootDir, "node_modules", "@types"),
  ].filter(existsSync);
  const options: ts.CompilerOptions = {
    allowSyntheticDefaultImports: true,
    emitDecoratorMetadata: true,
    esModuleInterop: true,
    experimentalDecorators: true,
    forceConsistentCasingInFileNames: true,
    isolatedModules: true,
    jsx: ts.JsxEmit.ReactJSX,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    noEmit: true,
    noUnusedLocals: false,
    noUnusedParameters: false,
    paths: createPackagePaths(rootDir),
    resolveJsonModule: true,
    skipDefaultLibCheck: true,
    skipLibCheck: true,
    strict: true,
    strictPropertyInitialization: false,
    target: ts.ScriptTarget.ES2022,
  };

  if (typeRoots.length > 0) {
    options.typeRoots = typeRoots;
  }

  return options;
}

function createPackagePaths(rootDir: string): ts.MapLike<string[]> {
  const packagesDir = join(rootDir, "packages");
  const paths: ts.MapLike<string[]> = {};

  if (!existsSync(packagesDir)) {
    return paths;
  }

  for (const entry of readdirSync(packagesDir, { withFileTypes: true }).sort((left, right) =>
    left.name.localeCompare(right.name),
  )) {
    if (!entry.isDirectory()) {
      continue;
    }

    const packageDir = join(packagesDir, entry.name);
    const packageJsonPath = join(packageDir, "package.json");
    const sourceIndexPath = join(packageDir, "src", "index.ts");

    if (!existsSync(packageJsonPath) || !existsSync(sourceIndexPath)) {
      continue;
    }

    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8")) as unknown;
    if (!isRecord(packageJson) || typeof packageJson.name !== "string") {
      continue;
    }

    paths[packageJson.name] = [normalizePath(sourceIndexPath)];
  }

  return paths;
}

function generateVirtualFiles(
  rootDir: string,
  blocks: readonly MarkdownCodeBlock[],
): {
  readonly blocksByFile: ReadonlyMap<string, MarkdownCodeBlock>;
  readonly files: ReadonlyMap<string, string>;
} {
  const files = new Map<string, string>();
  const blocksByFile = new Map<string, MarkdownCodeBlock>();

  for (const block of blocks) {
    const extension = block.language === "tsx" ? "tsx" : "ts";
    const fileName = join(
      rootDir,
      ".croco-doc-examples",
      `${sanitizeFileName(block.file)}.${block.typeScriptBlockIndex}.${extension}`,
    );
    const source = [`// Source: ${formatBlock(block)}`, "", block.code, "", "export {};", ""].join(
      "\n",
    );
    const normalizedFileName = normalizePath(fileName);

    files.set(normalizedFileName, source);
    blocksByFile.set(normalizedFileName, block);
  }

  return {
    blocksByFile,
    files,
  };
}

function createVirtualCompilerHost(
  options: ts.CompilerOptions,
  files: ReadonlyMap<string, string>,
): ts.CompilerHost {
  const host = ts.createCompilerHost(options, true);
  const defaultFileExists = host.fileExists.bind(host);
  const defaultGetSourceFile = host.getSourceFile.bind(host);
  const defaultReadFile = host.readFile.bind(host);

  host.fileExists = (fileName) => files.has(normalizePath(fileName)) || defaultFileExists(fileName);
  host.readFile = (fileName) => files.get(normalizePath(fileName)) ?? defaultReadFile(fileName);
  host.getSourceFile = (fileName, languageVersion, onError, shouldCreateNewSourceFile) => {
    const source = files.get(normalizePath(fileName));
    if (source !== undefined) {
      return ts.createSourceFile(fileName, source, languageVersion, true);
    }

    return defaultGetSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile);
  };

  return host;
}

function formatDiagnostic(
  diagnostic: ts.Diagnostic,
  blocksByFile: ReadonlyMap<string, MarkdownCodeBlock>,
): string {
  const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
  const fileName = diagnostic.file ? normalizePath(diagnostic.file.fileName) : undefined;
  const block = fileName ? blocksByFile.get(fileName) : undefined;

  if (!diagnostic.file || diagnostic.start === undefined || !block) {
    return message;
  }

  const position = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
  const generatedHeaderLineCount = 2;
  const docLine = Math.max(
    block.openingLine + 1,
    block.openingLine + 1 + position.line - generatedHeaderLineCount,
  );

  return `${block.file}:${docLine}: ${message}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getBlockKey(block: MarkdownCodeBlock): string {
  return `${block.file}#${block.typeScriptBlockIndex}`;
}

function getBaselineEntryKey(entry: BaselineEntry): string {
  return `${entry.file}#${entry.blockIndex}`;
}

function formatBlock(block: MarkdownCodeBlock): string {
  return `${block.file}:${block.openingLine} (TypeScript block ${block.typeScriptBlockIndex})`;
}

function formatBaselineEntry(entry: BaselineEntry): string {
  return `${entry.file}:${entry.openingLine} (TypeScript block ${entry.blockIndex})`;
}

function normalizeRelativePath(rootDir: string, filePath: string): string {
  return normalizePath(relative(rootDir, filePath));
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/");
}

function sanitizeFileName(file: string): string {
  return file.replace(/[^a-zA-Z0-9.-]+/g, "_");
}
