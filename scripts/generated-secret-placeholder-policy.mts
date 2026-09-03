#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { argv, exit, stdout } from "node:process";
import { fileURLToPath } from "node:url";
import {
  readGeneratedTemplateSecretAllowlistsFromMetadata,
  scanGeneratedTemplateSecretText,
} from "../packages/create-croco-app/src/secret-placeholder-policy.ts";

type Options = {
  readonly metadataPath: string;
  readonly rootDir: string;
  readonly scanPaths: readonly string[];
  readonly today: string;
};

type Violation = {
  readonly message: string;
  readonly recovery: string;
};

const defaultRootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const defaultMetadataPath = "scripts/security-allowlist-metadata.json";
const defaultScanPaths = [".env.example", "packages/create-croco-app/templates"] as const;
const ignoredDirectories = new Set([".git", ".turbo", "coverage", "dist", "node_modules", "out"]);
const textExtensions = new Set([
  ".cjs",
  ".css",
  ".hbs",
  ".html",
  ".js",
  ".json",
  ".jsonc",
  ".md",
  ".mjs",
  ".mts",
  ".ts",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml",
]);
const textFileNames = new Set([
  ".env",
  ".env.development",
  ".env.example",
  ".env.local",
  ".env.production",
]);

function log(message = ""): void {
  stdout.write(`${message}\n`);
}

function main(): void {
  const options = parseArgs(argv.slice(2));
  const violations: Violation[] = [];
  const metadata = readMetadata(options.metadataPath, violations);
  const allowlistRead = readGeneratedTemplateSecretAllowlistsFromMetadata(metadata, options.today);
  violations.push(...allowlistRead.violations);

  validateGeneratedHelperDrift(options.rootDir, violations);

  for (const scanPath of options.scanPaths) {
    const absolutePath = resolveFromRoot(options.rootDir, scanPath);
    if (!existsSync(absolutePath)) {
      violations.push({
        message: `generated template scan path is missing: ${scanPath}`,
        recovery: `Create ${scanPath}, or remove it from generated-secret-placeholders:check inputs.`,
      });
      continue;
    }

    for (const filePath of listTextFiles(absolutePath)) {
      const relativePath = normalizePath(relative(options.rootDir, filePath));
      const text = readFileSync(filePath, "utf-8");
      const findings = scanGeneratedTemplateSecretText(
        relativePath,
        text,
        allowlistRead.allowlists,
      );

      violations.push(
        ...findings.map((finding) => ({
          message: `${finding.filePath}:${finding.line} contains ${finding.patternId} shaped value ${finding.match}`,
          recovery:
            "Replace it with <croco-secret:ENV_NAME> or <croco-config:ENV_NAME>, or add a reviewed secretScan.generatedTemplates allowlist entry with owner and reason.",
        })),
      );
    }
  }

  if (violations.length > 0) {
    log("generated-secret-placeholder-policy: failed");
    for (const violation of violations) {
      log(`- ${violation.message}`);
      log(`  Recovery: ${violation.recovery}`);
    }
    exit(1);
  }

  log(
    `generated-secret-placeholder-policy: passed (${options.scanPaths.length} scan paths, ${allowlistRead.allowlists.length} generated template allowlists).`,
  );
}

function parseArgs(args: readonly string[]): Options {
  let metadataPath = defaultMetadataPath;
  let rootDir = defaultRootDir;
  const scanPaths: string[] = [];
  let today = new Date().toISOString().slice(0, 10);

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];

    if (arg === "--root") {
      rootDir = requireValue(args, index, arg);
      index++;
      continue;
    }

    if (arg === "--metadata") {
      metadataPath = requireValue(args, index, arg);
      index++;
      continue;
    }

    if (arg === "--path") {
      scanPaths.push(requireValue(args, index, arg));
      index++;
      continue;
    }

    if (arg === "--today") {
      today = requireValue(args, index, arg);
      index++;
      continue;
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  if (!isValidDate(today)) {
    throw new Error(`--today must be a valid YYYY-MM-DD date, received ${today}`);
  }

  const absoluteRootDir = resolve(rootDir);

  return {
    metadataPath: resolveFromRoot(absoluteRootDir, metadataPath),
    rootDir: absoluteRootDir,
    scanPaths: scanPaths.length > 0 ? scanPaths : defaultScanPaths,
    today,
  };
}

function requireValue(args: readonly string[], index: number, option: string): string {
  const value = args[index + 1];
  if (!value) {
    throw new Error(`${option} requires a value`);
  }

  return value;
}

function readMetadata(path: string, violations: Violation[]): unknown {
  if (!existsSync(path)) {
    violations.push({
      message: `security allowlist metadata is missing at ${path}`,
      recovery:
        "Create scripts/security-allowlist-metadata.json before adding template exceptions.",
    });
    return {};
  }

  try {
    return JSON.parse(readFileSync(path, "utf-8")) as unknown;
  } catch (error) {
    violations.push({
      message: `security allowlist metadata is invalid JSON at ${path}`,
      recovery: `Fix the JSON syntax: ${error instanceof Error ? error.message : String(error)}`,
    });
    return {};
  }
}

function validateGeneratedHelperDrift(rootDir: string, violations: Violation[]): void {
  const sourcePath = resolveFromRoot(
    rootDir,
    "packages/create-croco-app/src/secret-placeholder-policy.ts",
  );
  const templatePath = resolveFromRoot(
    rootDir,
    "packages/create-croco-app/templates/saas/apps/api-server/src/secret-placeholder-policy.ts",
  );

  if (!existsSync(sourcePath) || !existsSync(templatePath)) {
    return;
  }

  if (readFileSync(sourcePath, "utf-8") === readFileSync(templatePath, "utf-8")) {
    return;
  }

  violations.push({
    message:
      "CROCO_GENERATED_SECRET_PLACEHOLDER_HELPER_DRIFT: generated app secret-placeholder-policy.ts differs from create-croco-app source",
    recovery:
      "Copy packages/create-croco-app/src/secret-placeholder-policy.ts to the SaaS generated app template before changing placeholder policy behavior.",
  });
}

function listTextFiles(root: string): readonly string[] {
  const stat = statSync(root);
  if (stat.isFile()) {
    return isTextFile(root) ? [root] : [];
  }

  const files: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const fullPath = join(root, entry.name);
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) {
        files.push(...listTextFiles(fullPath));
      }
      continue;
    }

    if (entry.isFile() && isTextFile(fullPath)) {
      files.push(fullPath);
    }
  }

  return files.sort();
}

function isTextFile(path: string): boolean {
  const normalized = normalizePath(path);
  const fileName = normalized.slice(normalized.lastIndexOf("/") + 1);
  if (textFileNames.has(fileName)) {
    return !readFileSync(path).includes(0);
  }

  const extension = normalized.includes(".") ? normalized.slice(normalized.lastIndexOf(".")) : "";
  if (!textExtensions.has(extension)) {
    return false;
  }

  return !readFileSync(path).includes(0);
}

function resolveFromRoot(rootDir: string, path: string): string {
  return resolve(rootDir, path);
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/");
}

function isValidDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`));
}

main();
