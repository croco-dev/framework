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

  return {
    typecheckedCount: typecheckedBlocks.length,
    violations,
  };
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
  return docsRoots
    .flatMap((docRoot) => {
      const path = join(rootDir, docRoot);
      if (!existsSync(path)) {
        return [];
      }

      if (isMarkdownFile(path)) {
        return [path];
      }

      return collectMarkdownFilesInDirectory(path);
    })
    .sort((left, right) => relative(rootDir, left).localeCompare(relative(rootDir, right)));
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
    baseUrl: rootDir,
    downlevelIteration: true,
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

    paths[packageJson.name] = [normalizePath(relative(rootDir, sourceIndexPath))];
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
