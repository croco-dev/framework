import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Node, Project, SyntaxKind } from "ts-morph";
import type { Expression, Node as TsMorphNode, ReturnStatement, SourceFile } from "ts-morph";

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
    if (
      hasNamedArrayLiteral(content, "controllers") &&
      isControllersConnectedToApplication(content, "controllers")
    ) {
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

function isControllersConnectedToApplication(content: string, arrayName: string): boolean {
  const sourceFile = controllerRegistrationTargetProject.createSourceFile(
    "/controller-registration-target/named-connection.ts",
    content,
    { overwrite: true },
  );
  try {
    return findCreateAppControllersInitializers(sourceFile).some((controllersInitializer) =>
      resolvesToVariable(controllersInitializer, arrayName, sourceFile, new Set(), new Set()),
    );
  } finally {
    controllerRegistrationTargetProject.removeSourceFile(sourceFile);
  }
}

function hasApplicationControllerTarget(content: string): boolean {
  const sourceFile = controllerRegistrationTargetProject.createSourceFile(
    "/controller-registration-target/application-target.ts",
    content,
    { overwrite: true },
  );
  try {
    if (hasAddControllersCall(sourceFile)) return true;
    if (findCreateAppControllersInitializers(sourceFile).length > 0) return true;
    return hasCreateAppCall(sourceFile);
  } finally {
    controllerRegistrationTargetProject.removeSourceFile(sourceFile);
  }
}

function hasControllerRegistrationTarget(content: string): boolean {
  return hasApplicationControllerTarget(content);
}

function hasAddControllersCall(sourceFile: SourceFile): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => {
    const expression = call.getExpression();
    return Node.isPropertyAccessExpression(expression) && expression.getName() === "addControllers";
  });
}

function hasCreateAppCall(sourceFile: SourceFile): boolean {
  return sourceFile
    .getDescendantsOfKind(SyntaxKind.CallExpression)
    .some((call) => isCreateAppExpression(call.getExpression()));
}

function isCreateAppExpression(expression: Expression): boolean {
  if (Node.isIdentifier(expression)) return expression.getText() === "createApp";
  if (Node.isPropertyAccessExpression(expression)) return expression.getName() === "createApp";
  return false;
}

function findCreateAppControllersInitializers(sourceFile: SourceFile): string[] {
  const initializers: string[] = [];
  for (const call of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    if (!isCreateAppExpression(call.getExpression())) continue;

    const options = call.getArguments()[0];
    if (!options || !Node.isObjectLiteralExpression(options)) continue;

    const controllers = options.getProperty("controllers");
    if (Node.isPropertyAssignment(controllers)) {
      const initializer = controllers.getInitializer();
      if (initializer) initializers.push(initializer.getText());
    } else if (Node.isShorthandPropertyAssignment(controllers)) {
      initializers.push(controllers.getName());
    }
  }
  return initializers;
}

function findVariableInitializers(sourceFile: SourceFile, name: string): Expression[] {
  return sourceFile
    .getDescendantsOfKind(SyntaxKind.VariableDeclaration)
    .filter((declaration) => declaration.getName() === name)
    .map((declaration) => declaration.getInitializer())
    .filter((initializer): initializer is Expression => initializer !== undefined);
}

function resolvesToVariable(
  expressionText: string,
  variableName: string,
  sourceFile: SourceFile,
  seen: Set<string>,
  callees: Set<string>,
): boolean {
  const normalized = expressionText.trim();
  if (normalized === variableName) return true;

  if (/^[A-Za-z_$][\w$]*$/.test(normalized)) {
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return findVariableInitializers(sourceFile, normalized).some((initializer) =>
      initializerResolvesTo(initializer, variableName, sourceFile, seen, callees),
    );
  }

  if (normalized.startsWith("[") && normalized.endsWith("]")) {
    return normalized
      .slice(1, -1)
      .split(",")
      .map((part) => part.replace(/^\.\.\./, "").trim())
      .filter((part) => part.length > 0)
      .some((part) => resolvesToVariable(part, variableName, sourceFile, seen, callees));
  }

  const calleeName = parseCallExpressionCallee(normalized);
  if (calleeName) {
    return collectCalleeReturnTexts(sourceFile, calleeName, callees).some((text) =>
      resolvesToVariable(text, variableName, sourceFile, seen, callees),
    );
  }

  return false;
}

function initializerResolvesTo(
  initializer: Expression,
  variableName: string,
  sourceFile: SourceFile,
  seen: Set<string>,
  callees: Set<string>,
): boolean {
  if (Node.isIdentifier(initializer)) {
    return resolvesToVariable(initializer.getText(), variableName, sourceFile, seen, callees);
  }
  if (Node.isCallExpression(initializer)) {
    if (Node.isPropertyAccessExpression(initializer.getExpression())) return false;
    return collectCalleeReturnTexts(
      sourceFile,
      initializer.getExpression().getText(),
      callees,
    ).some((text) => resolvesToVariable(text, variableName, sourceFile, seen, callees));
  }
  if (Node.isArrayLiteralExpression(initializer)) {
    return initializer
      .getElements()
      .map((element) =>
        Node.isSpreadElement(element) ? element.getExpression().getText() : element.getText(),
      )
      .some((text) => resolvesToVariable(text, variableName, sourceFile, seen, callees));
  }
  return false;
}

function collectCalleeReturnTexts(
  sourceFile: SourceFile,
  calleeName: string,
  callees: Set<string>,
): string[] {
  if (calleeName.includes(".") || callees.has(calleeName)) return [];
  callees.add(calleeName);
  try {
    const bodies: Array<{
      getDescendantsOfKind: SourceFile["getDescendantsOfKind"];
    }> = sourceFile.getFunctions().filter((fn) => fn.getName() === calleeName);
    for (const declaration of sourceFile.getDescendantsOfKind(SyntaxKind.VariableDeclaration)) {
      if (declaration.getName() !== calleeName) continue;
      const initializer = declaration.getInitializer();
      if (Node.isArrowFunction(initializer) || Node.isFunctionExpression(initializer)) {
        bodies.push(initializer);
      }
    }
    return bodies.flatMap((body) =>
      collectDirectReturnTexts(body)
        .map((statement) => statement.getExpression()?.getText() ?? "")
        .filter((text) => text.length > 0),
    );
  } finally {
    callees.delete(calleeName);
  }
}

function collectDirectReturnTexts(body: {
  getDescendantsOfKind: SourceFile["getDescendantsOfKind"];
}): ReturnStatement[] {
  return body
    .getDescendantsOfKind(SyntaxKind.ReturnStatement)
    .filter((statement) => getOwningFunction(statement) === body);
}

function getOwningFunction(statement: ReturnStatement): TsMorphNode | undefined {
  let current: TsMorphNode | undefined = statement.getParent();
  while (current) {
    if (
      Node.isFunctionDeclaration(current) ||
      Node.isArrowFunction(current) ||
      Node.isFunctionExpression(current) ||
      Node.isMethodDeclaration(current)
    ) {
      return current;
    }
    current = current.getParent();
  }
  return undefined;
}

function parseCallExpressionCallee(expressionText: string): string | null {
  const match = /^([A-Za-z_$][\w$]*)\s*\(.*\)$/.exec(expressionText);
  return match?.[1] ?? null;
}
