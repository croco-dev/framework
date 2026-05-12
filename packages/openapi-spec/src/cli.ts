#!/usr/bin/env node
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { type ClassDeclaration, Project, type SourceFile, ts } from "ts-morph";
import { emitOpenAPI } from "./libs/emitOpenAPI";

type CliOptions = {
  readonly controllers: string;
  readonly outFile: string;
  readonly title: string;
  readonly version: string;
};

type Controller = Function;

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  if (!options) {
    printHelp();
    process.exitCode = 1;
    return;
  }

  const controllers = await loadControllers(options.controllers);
  const document = emitOpenAPI(controllers);
  document.info.title = options.title;
  document.info.version = options.version;

  await writeFile(options.outFile, JSON.stringify(document, null, 2));
}

function parseArgs(args: string[]): CliOptions | null {
  if (args.includes("--help") || args.includes("-h")) {
    return null;
  }

  const controllers = getFlagValue(args, "--controllers");
  const outFile = getFlagValue(args, "--out");

  if (!controllers || !outFile) {
    return null;
  }

  return {
    controllers,
    outFile,
    title: getFlagValue(args, "--title") ?? "Croco API",
    version: getFlagValue(args, "--version") ?? "1.0.0",
  };
}

function getFlagValue(args: string[], flag: string): string | null {
  const index = args.indexOf(flag);
  const value = index >= 0 ? args[index + 1] : undefined;

  return value && !value.startsWith("--") ? value : null;
}

async function loadControllers(glob: string): Promise<Controller[]> {
  const project = new Project({
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      experimentalDecorators: true,
      emitDecoratorMetadata: true,
      noEmitOnError: false,
    },
  });
  project.addSourceFilesAtPaths(glob);
  const sourceFiles = project.getSourceFiles();

  if (sourceFiles.length === 0) {
    return [];
  }

  const rootDir = getCommonSourceDir(sourceFiles);
  const emitDir = fs.mkdtempSync(path.join(os.tmpdir(), "croco-openapi-spec-"));
  project.compilerOptions.set({ rootDir, outDir: emitDir });

  try {
    project.emitSync();
    const controllers: Controller[] = [];

    for (const cls of sourceFiles.flatMap((sourceFile) => sourceFile.getClasses())) {
      const controller = await importController(
        cls,
        getEmittedFilePath(rootDir, emitDir, cls.getSourceFile()),
      );
      controllers.push(controller);
    }

    return controllers;
  } finally {
    fs.rmSync(emitDir, { recursive: true, force: true });
  }
}

async function importController(cls: ClassDeclaration, filePath: string): Promise<Controller> {
  const module = (await import(pathToFileURL(filePath).href)) as Record<string, unknown>;
  const exported = module[cls.getName() ?? ""];

  if (typeof exported !== "function") {
    throw new Error(
      `Controller class '${cls.getName() ?? "<anonymous>"}' is not exported from ${filePath}`,
    );
  }

  return exported;
}

function getCommonSourceDir(sourceFiles: SourceFile[]): string {
  const dirs = sourceFiles.map((sourceFile) => path.dirname(sourceFile.getFilePath()));
  const [firstDir, ...remainingDirs] = dirs.map((dir) => dir.split(path.sep));

  if (!firstDir) {
    return process.cwd();
  }

  const commonParts = firstDir.filter((part, index) =>
    remainingDirs.every((dir) => dir[index] === part),
  );
  const commonDir = commonParts.join(path.sep);

  return commonDir.startsWith(path.sep) ? commonDir : `${path.sep}${commonDir}`;
}

function getEmittedFilePath(rootDir: string, emitDir: string, sourceFile: SourceFile): string {
  const relativePath = path
    .relative(rootDir, sourceFile.getFilePath())
    .replace(/\.[cm]?tsx?$/, ".js");

  return path.join(emitDir, relativePath);
}

function printHelp(): void {
  console.log(`Usage: croco-openapi-spec --controllers <glob> --out <file> [--title <s>] [--version <s>]

Options:
  --controllers <glob>  Controller files to load
  --out <file>          OpenAPI JSON output file
  --title <s>           API title (default: Croco API)
  --version <s>         API version (default: 1.0.0)`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
