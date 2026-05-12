import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import { extractRouteIR, type RouteIR } from "@croco/protocols-core";
import { type ClassDeclaration, Project, type SourceFile, ts } from "ts-morph";
import { generateClientFiles } from "./libs/generate";

type Constructor = new (...args: unknown[]) => unknown;

type CliOptions = {
  readonly controllers: string;
  readonly outDir: string;
  readonly reactQuery: boolean;
};

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  if (!options) {
    printHelp();
    return;
  }

  const routes = await loadRoutes(options.controllers);
  const files = generateClientFiles(routes, options.outDir, { reactQuery: options.reactQuery });

  for (const file of files) {
    console.log(file);
  }
}

function parseArgs(args: string[]): CliOptions | null {
  if (args.includes("--help") || args.includes("-h")) {
    return null;
  }

  const controllers = getFlagValue(args, "--controllers");
  const outDir = getFlagValue(args, "--out");

  if (!controllers || !outDir) {
    return null;
  }

  return {
    controllers,
    outDir,
    reactQuery: args.includes("--react-query"),
  };
}

function getFlagValue(args: string[], flag: string): string | null {
  const index = args.indexOf(flag);
  const value = index >= 0 ? args[index + 1] : undefined;

  return value && !value.startsWith("--") ? value : null;
}

async function loadRoutes(glob: string): Promise<RouteIR[]> {
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
  const emitDir = fs.mkdtempSync(path.join(os.tmpdir(), "croco-rpc-codegen-"));
  project.compilerOptions.set({ rootDir, outDir: emitDir });

  try {
    project.emitSync();
    const routes: RouteIR[] = [];

    for (const cls of sourceFiles.flatMap((sourceFile) => sourceFile.getClasses())) {
      const controllerCtor = await importController(
        cls,
        getEmittedFilePath(rootDir, emitDir, cls.getSourceFile()),
      );
      routes.push(...extractRouteIR(controllerCtor));
    }

    return routes;
  } finally {
    fs.rmSync(emitDir, { recursive: true, force: true });
  }
}

async function importController(cls: ClassDeclaration, filePath: string): Promise<Constructor> {
  const module = (await import(pathToFileURL(filePath).href)) as Record<string, unknown>;
  const exported = module[cls.getName() ?? ""];

  if (typeof exported !== "function") {
    throw new Error(
      `Controller class '${cls.getName() ?? "<anonymous>"}' is not exported from ${filePath}`,
    );
  }

  return exported as Constructor;
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
  console.log(`Usage: croco-rpc-codegen --controllers <glob> --out <dir> [--react-query]

Options:
  --controllers <glob>  Controller files to load
  --out <dir>           Output directory for generated clients
  --react-query         Generate React Query hooks
  --help, -h            Show this help message`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
