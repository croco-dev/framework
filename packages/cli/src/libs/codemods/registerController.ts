import { readFile, writeFile } from "node:fs/promises";
import { Node, Project, QuoteKind, SyntaxKind } from "ts-morph";
import type {
  ArrayLiteralExpression,
  CallExpression,
  PropertyAssignment,
  SourceFile,
} from "ts-morph";

export type RegisterControllerOptions = {
  readonly entryPath: string;
  readonly importPath: string;
  readonly className: string;
  readonly dryRun?: boolean;
};

export type RegisterControllerResult =
  | {
      readonly status: "updated-idempotent" | "updated";
      readonly importPath: string;
      readonly className: string;
    }
  | {
      readonly status: "unsupported-pattern";
      readonly hint: string;
      readonly importPath: string;
      readonly className: string;
    };

type UpdateResult = "updated" | "updated-idempotent" | "unsupported-pattern" | "not-found";

export async function registerController(
  options: RegisterControllerOptions,
): Promise<RegisterControllerResult> {
  const content = await readFile(options.entryPath, "utf-8");
  const project = new Project({
    manipulationSettings: {
      quoteKind: QuoteKind.Single,
    },
  });
  const sourceFile = project.createSourceFile(options.entryPath, content, { overwrite: true });

  const activeResult = addToActiveRegistration(sourceFile, options.className);
  const updateResult =
    activeResult === "not-found"
      ? addCommentedRegistration(sourceFile, options.className)
      : activeResult;

  if (updateResult === "unsupported-pattern") {
    return unsupportedResult(options, "Controller registration uses unsupported array syntax.");
  }

  const finalResult =
    updateResult === "not-found"
      ? addRegistrationBeforeListen(sourceFile, options.className)
      : updateResult;

  if (finalResult === "not-found") {
    return unsupportedResult(
      options,
      "Could not find app.addControllers, createApp controllers, or app.listen pattern.",
    );
  }

  if (finalResult === "unsupported-pattern") {
    return unsupportedResult(options, "Controller registration uses unsupported array syntax.");
  }

  if (finalResult === "updated") {
    addImport(sourceFile, options.importPath, options.className);
    sourceFile.organizeImports();
  }

  if (!options.dryRun && finalResult === "updated") {
    await writeFile(options.entryPath, sourceFile.getFullText(), "utf-8");
  }

  return {
    status: finalResult,
    importPath: options.importPath,
    className: options.className,
  };
}

function addToActiveRegistration(sourceFile: SourceFile, className: string): UpdateResult {
  for (const call of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const expression = call.getExpression();
    if (Node.isPropertyAccessExpression(expression) && expression.getName() === "addControllers") {
      return addToCallArray(call, className);
    }

    if (Node.isIdentifier(expression) && expression.getText() === "createApp") {
      const result = addToCreateAppControllers(call, className);
      if (result !== "not-found") return result;
    }
  }

  return "not-found";
}

function addToCallArray(call: CallExpression, className: string): UpdateResult {
  const argument = call.getArguments()[0];

  if (!argument || !Node.isArrayLiteralExpression(argument)) {
    return "unsupported-pattern";
  }

  return addToArray(argument, className);
}

function addToCreateAppControllers(call: CallExpression, className: string): UpdateResult {
  const options = call.getArguments()[0];
  if (!options || !Node.isObjectLiteralExpression(options)) return "not-found";

  const controllers = options.getProperty("controllers");
  if (!controllers || !Node.isPropertyAssignment(controllers)) return "not-found";

  return addToPropertyArray(controllers, className);
}

function addToPropertyArray(property: PropertyAssignment, className: string): UpdateResult {
  const initializer = property.getInitializer();

  if (!initializer || !Node.isArrayLiteralExpression(initializer)) {
    return "unsupported-pattern";
  }

  return addToArray(initializer, className);
}

function addToArray(arrayLiteral: ArrayLiteralExpression, className: string): UpdateResult {
  const elements = arrayLiteral.getElements();

  if (elements.some((element) => Node.isSpreadElement(element))) {
    return "unsupported-pattern";
  }

  if (elements.some((element) => element.getText() === className)) {
    return "updated-idempotent";
  }

  arrayLiteral.addElement(className);
  return "updated";
}

function addCommentedRegistration(sourceFile: SourceFile, className: string): UpdateResult {
  const fullText = sourceFile.getFullText();
  const match = fullText.match(/^(\s*)\/\/\s*(.+\.addControllers\(\[[^\n]*\]\);?)\s*$/m);
  if (!match || match.index === undefined) return "not-found";

  const nextText = `${fullText.slice(0, match.index)}${match[1]}${match[2]}${fullText.slice(match.index + match[0].length)}`;
  sourceFile.replaceWithText(nextText);

  return addToActiveRegistration(sourceFile, className);
}

function addRegistrationBeforeListen(sourceFile: SourceFile, className: string): UpdateResult {
  const listenCall = sourceFile
    .getDescendantsOfKind(SyntaxKind.CallExpression)
    .find((call) => isListenCall(call));

  const statement = listenCall?.getFirstAncestorByKind(SyntaxKind.ExpressionStatement);
  if (!statement) return "not-found";

  statement.replaceWithText(`app.addControllers([${className}]);\n${statement.getText()}`);
  return "updated";
}

function isListenCall(call: CallExpression): boolean {
  const expression = call.getExpression();

  if (Node.isIdentifier(expression)) {
    return expression.getText() === "listen";
  }

  return Node.isPropertyAccessExpression(expression) && expression.getName() === "listen";
}

function unsupportedResult(
  options: RegisterControllerOptions,
  hint: string,
): RegisterControllerResult {
  return {
    status: "unsupported-pattern",
    hint,
    importPath: options.importPath,
    className: options.className,
  };
}

function addImport(sourceFile: SourceFile, importPath: string, className: string): void {
  const importDeclaration = sourceFile
    .getImportDeclarations()
    .find((declaration) => declaration.getModuleSpecifierValue() === importPath);

  if (!importDeclaration) {
    sourceFile.addImportDeclaration({
      namedImports: [className],
      moduleSpecifier: importPath,
    });
    return;
  }

  const hasImport = importDeclaration
    .getNamedImports()
    .some((namedImport) => namedImport.getName() === className);
  if (!hasImport) {
    importDeclaration.addNamedImport(className);
  }
}
