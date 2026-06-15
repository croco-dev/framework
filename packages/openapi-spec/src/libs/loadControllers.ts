import * as fs from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import { discoverControllerConstructors, type Constructor } from "@croco/protocols-core";
import { Project, type SourceFile, ts } from "ts-morph";

type Controller = Constructor;

class NoRestControllersFoundProblem extends Error {
  readonly code = "openapi-spec/no-rest-controllers-found";
  readonly type = "about:blank";
  readonly title = "Bad Request";
  readonly status = 400;
  readonly category = "BadRequest";
  readonly detail: string;

  constructor(glob: string) {
    const detail = getNoRestControllersFoundMessage(glob);

    super(detail);
    this.detail = detail;
    this.name = new.target.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  toJSON(): Record<string, unknown> {
    return {
      type: this.type,
      title: this.title,
      status: this.status,
      code: this.code,
      detail: this.detail,
    };
  }
}

export async function loadControllers(glob: string): Promise<Controller[]> {
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
    path.join(getModuleResolutionRoot(rootDir), ".croco-openapi-spec-"),
  );
  project.compilerOptions.set({ rootDir, outDir: emitDir });

  try {
    project.emitSync();
    const controllers: Controller[] = [];

    for (const sourceFile of sourceFiles) {
      const moduleExports = await importEmittedModule(
        getEmittedFilePath(rootDir, emitDir, sourceFile),
      );
      controllers.push(...discoverControllerConstructors(moduleExports));
    }

    if (controllers.length === 0) {
      throw new NoRestControllersFoundProblem(glob);
    }

    return controllers;
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
