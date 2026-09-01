#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  renameSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { argv, env, exit } from "node:process";
import { fileURLToPath } from "node:url";

const DOCS_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const REPOSITORY_ROOT = resolve(DOCS_ROOT, "..", "..");
const API_DOCS_RELATIVE_PATH = join("src", "content", "docs", "api");
const CACHED_API_DOCS_PATH = join(DOCS_ROOT, ".turbo", "docs-api", "rendered");

function run(command: string, args: readonly string[], environment = env): void {
  const result = spawnSync(command, args, {
    cwd: command === "pnpm" && args[0] === "--workspace-root" ? REPOSITORY_ROOT : DOCS_ROOT,
    env: environment,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed with exit code ${result.status ?? "unknown"}`,
    );
  }
}

function ensureApiModels(): void {
  if (env.TURBO_HASH) return;
  run("pnpm", ["--workspace-root", "turbo", "run", "docs:api:model", "--env-mode=loose"]);
}

function copyDirectory(source: string, destination: string): void {
  if (!existsSync(source)) return;
  mkdirSync(dirname(destination), { recursive: true });
  cpSync(source, destination, { recursive: true });
}

function ensureNodeModules(buildRoot: string): void {
  const isolatedNodeModules = join(buildRoot, "node_modules");
  if (existsSync(isolatedNodeModules)) return;
  symlinkSync(join(DOCS_ROOT, "node_modules"), isolatedNodeModules, "dir");
}

function runAstro(buildRoot: string, command: "build" | "sync", apiOnly = false): void {
  ensureNodeModules(buildRoot);
  run("pnpm", ["exec", "astro", command], {
    ...env,
    CROCO_DOCS_API_ONLY: apiOnly ? "1" : undefined,
    CROCO_DOCS_BUILD_ROOT: buildRoot,
  });
}

function buildHermetically(): void {
  ensureApiModels();
  const temporaryRoot = mkdtempSync(join(tmpdir(), "croco-docs-build-"));
  try {
    copyDirectory(join(DOCS_ROOT, "src"), join(temporaryRoot, "src"));
    copyDirectory(join(DOCS_ROOT, "public"), join(temporaryRoot, "public"));
    runAstro(temporaryRoot, "build");

    const output = join(DOCS_ROOT, "dist");
    rmSync(output, { force: true, recursive: true });
    mkdirSync(dirname(output), { recursive: true });
    cpSync(join(temporaryRoot, "dist"), output, { recursive: true });
  } finally {
    rmSync(temporaryRoot, { force: true, recursive: true });
  }
}

function markdownFiles(directory: string): readonly string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return markdownFiles(path);
    if (entry.isFile() && entry.name.endsWith(".md")) return [path];
    throw new Error(`generated API docs contain unsupported path type: ${path}`);
  });
}

function publishApiDocs(generatedApiDocs: string): void {
  const stagedOutput = `${CACHED_API_DOCS_PATH}.next-${process.pid}`;
  rmSync(stagedOutput, { force: true, recursive: true });
  try {
    mkdirSync(dirname(stagedOutput), { recursive: true });
    cpSync(generatedApiDocs, stagedOutput, { recursive: true });
    rmSync(CACHED_API_DOCS_PATH, { force: true, recursive: true });
    renameSync(stagedOutput, CACHED_API_DOCS_PATH);
  } finally {
    rmSync(stagedOutput, { force: true, recursive: true });
  }
}

function renderApiDocs(): void {
  ensureApiModels();
  const temporaryRoot = mkdtempSync(join(tmpdir(), "croco-api-docs-render-"));
  try {
    copyDirectory(
      join(DOCS_ROOT, "src", "content.config.ts"),
      join(temporaryRoot, "src", "content.config.ts"),
    );
    mkdirSync(join(temporaryRoot, API_DOCS_RELATIVE_PATH), { recursive: true });
    runAstro(temporaryRoot, "sync", true);

    const generatedApiDocs = join(temporaryRoot, API_DOCS_RELATIVE_PATH);
    const generatedMarkdown = markdownFiles(generatedApiDocs);
    if (generatedMarkdown.length === 0) {
      throw new Error("API documentation render produced no Markdown files");
    }
    run("pnpm", ["exec", "oxfmt", "--write", ...generatedMarkdown]);
    publishApiDocs(generatedApiDocs);
  } finally {
    rmSync(temporaryRoot, { force: true, recursive: true });
  }
}

function runDocsDev(): void {
  ensureApiModels();
  run("pnpm", ["exec", "astro", "dev", "--host"], {
    ...env,
    CROCO_DOCS_API_ONLY: undefined,
    CROCO_DOCS_BUILD_ROOT: undefined,
  });
}

try {
  if (argv.includes("--api-render")) {
    renderApiDocs();
  } else if (argv.includes("--dev")) {
    runDocsDev();
  } else {
    buildHermetically();
  }
} catch (error: unknown) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  exit(1);
}
