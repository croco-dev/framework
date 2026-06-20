#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

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
};

type LineDetector = {
  readonly match: (line: string) => RegExpMatchArray | null;
  readonly message: string;
  readonly action: string;
};

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

const STATIC_MISUSE_RULES: readonly StaticMisuseRule[] = [
  repositoryBoundaryRule,
  restGeneratedContractRule,
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

  const diagnostics = walkSourceFiles(targetDir).flatMap((filePath) => {
    const source = readFileSync(filePath, "utf-8");
    const lines = source.split(/\r?\n/);
    const relativeFile = toPosixPath(relative(rootDir, filePath));

    return lines.flatMap((line, lineIndex) => {
      if (isLineIgnored(lines, lineIndex, rule.code)) {
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

        return [
          {
            code: rule.code,
            ruleId: rule.id,
            file: relativeFile,
            line: lineIndex + 1,
            column: match.index === undefined ? 1 : match.index + 1,
            message: detector.message,
            excerpt: line.trim(),
            action: detector.action,
          },
        ];
      }

      return [];
    });
  });

  return {
    id: rule.id,
    code: rule.code,
    title: rule.title,
    targetDir: rule.targetDir,
    status: diagnostics.length > 0 ? "fail" : "pass",
    description: rule.description,
    limitation: rule.limitation,
    recovery: rule.recovery,
    diagnostics,
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
      console.error(
        `  escape hatch: // ${ignoreNextLinePrefix} ${result.code} -- explain why this direct reference is intentional`,
      );
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
