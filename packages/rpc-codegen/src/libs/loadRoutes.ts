import * as fs from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import {
  buildContractGraph,
  type Constructor,
  type ContractGraph,
  discoverControllerConstructors,
  type RouteIR,
} from "@croco/protocols-core";
import { Problem, ProblemCategory } from "@croco/problems-core";
import { Project, type SourceFile, ts } from "ts-morph";

class NoRestControllersFoundProblem extends Problem {
  constructor(glob: string) {
    super(
      "rpc-codegen/no-rest-controllers-found",
      ProblemCategory.BadRequest,
      getNoRestControllersFoundMessage(glob),
    );
  }
}

export async function loadRoutes(glob: string): Promise<RouteIR[]> {
  return [...(await loadContractGraph(glob)).routes];
}

export async function loadContractGraph(glob: string): Promise<ContractGraph> {
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
    throw new NoRestControllersFoundProblem(glob);
  }

  const rootDir = getCommonSourceDir(sourceFiles);
  const emitDir = fs.mkdtempSync(
    path.join(getModuleResolutionRoot(rootDir), ".croco-rpc-codegen-"),
  );
  project.compilerOptions.set({ rootDir, outDir: emitDir });

  try {
    project.emitSync();
    const controllerConstructors: Constructor[] = [];
    let controllerCount = 0;

    for (const sourceFile of sourceFiles) {
      const moduleExports = await importEmittedModule(
        getEmittedFilePath(rootDir, emitDir, sourceFile),
      );
      const controllers = discoverControllerConstructors(moduleExports);

      controllerCount += controllers.length;
      controllerConstructors.push(...controllers);
    }

    if (controllerCount === 0) {
      throw new NoRestControllersFoundProblem(glob);
    }

    return buildContractGraph(controllerConstructors);
  } finally {
    fs.rmSync(emitDir, { recursive: true, force: true });
  }
}

async function importEmittedModule(filePath: string): Promise<Record<string, unknown>> {
  return (await import(pathToFileURL(filePath).href)) as Record<string, unknown>;
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

  return path.isAbsolute(commonDir) ? commonDir : `${path.sep}${commonDir}`;
}

function getModuleResolutionRoot(sourceDir: string): string {
  let currentDir = sourceDir;

  while (true) {
    if (fs.existsSync(path.join(currentDir, "node_modules"))) {
      return currentDir;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      return process.cwd();
    }

    currentDir = parentDir;
  }
}

function getEmittedFilePath(rootDir: string, emitDir: string, sourceFile: SourceFile): string {
  const relativePath = path
    .relative(rootDir, sourceFile.getFilePath())
    .replace(/\.[cm]?tsx?$/, ".js");

  return path.join(emitDir, relativePath);
}

function getNoRestControllersFoundMessage(glob: string): string {
  return `No exported REST controllers found for '${glob}'. Ensure matched files export classes decorated with @Controller.`;
}
