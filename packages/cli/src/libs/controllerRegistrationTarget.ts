import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Node, Project } from "ts-morph";

export type ControllerRegistrationTarget = {
  readonly entryPath: string;
  readonly registrationArrayName?: string;
};

const controllerRegistrationTargetProject = new Project({
  useInMemoryFileSystem: true,
  skipAddingFilesFromTsConfig: true,
});

export function resolveControllerRegistrationTarget(
  apiServerSrc: string,
): ControllerRegistrationTarget {
  const applicationModulePath = join(apiServerSrc, "applicationModule.ts");
  if (existsSync(applicationModulePath)) {
    const content = readFileSync(applicationModulePath, "utf-8");
    if (hasNamedArrayLiteral(content, "SAAS_APPLICATION_CONTROLLERS")) {
      return {
        entryPath: applicationModulePath,
        registrationArrayName: "SAAS_APPLICATION_CONTROLLERS",
      };
    }
  }

  const appPath = join(apiServerSrc, "app.ts");
  if (existsSync(appPath)) {
    const content = readFileSync(appPath, "utf-8");
    if (hasNamedArrayLiteral(content, "controllers") && hasApplicationControllerTarget(content)) {
      return { entryPath: appPath, registrationArrayName: "controllers" };
    }
    if (hasControllerRegistrationTarget(content)) {
      return { entryPath: appPath };
    }
  }

  const indexPath = join(apiServerSrc, "index.ts");
  return { entryPath: existsSync(indexPath) ? indexPath : appPath };
}

function hasNamedArrayLiteral(content: string, name: string): boolean {
  const sourceFile = controllerRegistrationTargetProject.createSourceFile(
    `/controller-registration-target/${name}.ts`,
    content,
    { overwrite: true },
  );
  try {
    const initializer = sourceFile.getVariableDeclaration(name)?.getInitializer();
    return Node.isArrayLiteralExpression(initializer);
  } finally {
    controllerRegistrationTargetProject.removeSourceFile(sourceFile);
  }
}

function hasApplicationControllerTarget(content: string): boolean {
  return (
    content.includes("controllers:") ||
    content.includes("createApp(") ||
    content.includes(".addControllers(")
  );
}

function hasControllerRegistrationTarget(content: string): boolean {
  return hasApplicationControllerTarget(content);
}
