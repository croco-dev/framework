import { readFile, writeFile } from "node:fs/promises";
import { Node, Project, QuoteKind, SyntaxKind, VariableDeclarationKind } from "ts-morph";
import type {
  ArrayLiteralExpression,
  CallExpression,
  Identifier,
  PropertyAssignment,
  SourceFile,
  VariableDeclaration,
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
type ImportUpdateResult = "updated" | "updated-idempotent" | "conflicting-binding";

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
    return unsupportedResult(
      options,
      "Could not identify one Croco app variable and its listen call. Use one variable initialized by createApp() or createCrocoApp() and call listen through that variable.",
    );
  }

  const registeredIdentifier = findRegisteredControllerIdentifier(sourceFile, options.className);
  if (!registeredIdentifier) {
    return unsupportedResult(options, "Could not resolve the controller registration identifier.");
  }

  const importResult = reconcileImport(
    sourceFile,
    options.importPath,
    options.className,
    registeredIdentifier,
  );
  if (importResult === "conflicting-binding") {
    return unsupportedResult(
      options,
      `Controller identifier "${options.className}" is already bound and cannot be imported from "${options.importPath}".`,
    );
  }

  const status =
    finalResult === "updated" || importResult === "updated" ? "updated" : "updated-idempotent";

  if (status === "updated") {
    sourceFile.organizeImports();
  }

  if (!options.dryRun && status === "updated") {
    await writeFile(options.entryPath, sourceFile.getFullText(), "utf-8");
  }

  return {
    status,
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

    if (
      Node.isIdentifier(expression) &&
      expression.getText() === "createApp" &&
      isSupportedCrocoAppFactory(expression)
    ) {
      const result = addToCreateAppControllers(call, className);
      if (result !== "not-found") return result;
    }
  }

  return "not-found";
}

function findRegisteredControllerIdentifier(
  sourceFile: SourceFile,
  className: string,
): Identifier | undefined {
  for (const call of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const expression = call.getExpression();
    if (Node.isPropertyAccessExpression(expression) && expression.getName() === "addControllers") {
      const identifier = findIdentifierInCallArray(call, className);
      if (identifier) return identifier;
    }

    if (Node.isIdentifier(expression) && expression.getText() === "createApp") {
      const identifier = findIdentifierInCreateAppControllers(call, className);
      if (identifier) return identifier;
    }
  }

  return undefined;
}

function findIdentifierInCallArray(
  call: CallExpression,
  className: string,
): Identifier | undefined {
  const argument = call.getArguments()[0];
  return Node.isArrayLiteralExpression(argument)
    ? findIdentifierInArray(argument, className)
    : undefined;
}

function findIdentifierInCreateAppControllers(
  call: CallExpression,
  className: string,
): Identifier | undefined {
  const options = call.getArguments()[0];
  if (!options || !Node.isObjectLiteralExpression(options)) return undefined;

  const controllers = options.getProperty("controllers");
  if (Node.isPropertyAssignment(controllers)) {
    const initializer = controllers.getInitializer();
    if (Node.isArrayLiteralExpression(initializer)) {
      return findIdentifierInArray(initializer, className);
    }

    if (Node.isIdentifier(initializer)) {
      return findIdentifierInNamedArray(call.getSourceFile(), initializer.getText(), className);
    }
  }

  return Node.isShorthandPropertyAssignment(controllers)
    ? findIdentifierInNamedArray(call.getSourceFile(), controllers.getName(), className)
    : undefined;
}

function findIdentifierInNamedArray(
  sourceFile: SourceFile,
  identifierName: string,
  className: string,
): Identifier | undefined {
  const initializer = sourceFile.getVariableDeclaration(identifierName)?.getInitializer();
  return Node.isArrayLiteralExpression(initializer)
    ? findIdentifierInArray(initializer, className)
    : undefined;
}

function findIdentifierInArray(
  arrayLiteral: ArrayLiteralExpression,
  className: string,
): Identifier | undefined {
  const element = arrayLiteral
    .getElements()
    .find((candidate) => Node.isIdentifier(candidate) && candidate.getText() === className);
  return Node.isIdentifier(element) ? element : undefined;
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
  if (!controllers) return "not-found";

  if (Node.isPropertyAssignment(controllers)) {
    return addToPropertyArray(controllers, className);
  }

  if (Node.isShorthandPropertyAssignment(controllers)) {
    return addToNamedArray(call.getSourceFile(), controllers.getName(), className);
  }

  return "not-found";
}

function addToPropertyArray(property: PropertyAssignment, className: string): UpdateResult {
  const initializer = property.getInitializer();

  if (!initializer) {
    return "unsupported-pattern";
  }

  if (Node.isIdentifier(initializer)) {
    return addToNamedArray(property.getSourceFile(), initializer.getText(), className);
  }

  if (!Node.isArrayLiteralExpression(initializer)) {
    return "unsupported-pattern";
  }

  return addToArray(initializer, className);
}

function addToNamedArray(
  sourceFile: SourceFile,
  identifierName: string,
  className: string,
): UpdateResult {
  const declaration = sourceFile.getVariableDeclaration(identifierName);
  const initializer = declaration?.getInitializer();

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
  const appVariables = sourceFile
    .getVariableDeclarations()
    .filter((declaration) => isSupportedCrocoAppVariable(declaration));

  if (appVariables.length !== 1) return "unsupported-pattern";

  const appVariable = appVariables[0];
  if (!appVariable) return "unsupported-pattern";

  const receiverName = appVariable.getName();
  const listenCalls = sourceFile
    .getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter((call) => isListenCallOnReceiver(call, appVariable));

  if (listenCalls.length !== 1) return "unsupported-pattern";

  const statement = listenCalls[0]?.getFirstAncestorByKind(SyntaxKind.ExpressionStatement);
  if (!statement) return "unsupported-pattern";

  statement.replaceWithText(
    `${receiverName}.addControllers([${className}]);\n${statement.getText()}`,
  );
  return "updated";
}

function isSupportedCrocoAppVariable(declaration: VariableDeclaration): boolean {
  if (declaration.getVariableStatement()?.getDeclarationKind() !== VariableDeclarationKind.Const) {
    return false;
  }

  const name = declaration.getNameNode();
  const initializer = declaration.getInitializer();
  if (!Node.isIdentifier(name) || !Node.isCallExpression(initializer)) return false;

  const factory = initializer.getExpression();
  if (!Node.isIdentifier(factory)) return false;

  return isSupportedCrocoAppFactory(factory);
}

function isSupportedCrocoAppFactory(factory: Identifier): boolean {
  return (
    factory
      .getSymbol()
      ?.getDeclarations()
      .some((factoryDeclaration) => {
        if (!Node.isImportSpecifier(factoryDeclaration)) return false;

        const importedName = factoryDeclaration.getName();
        const moduleSpecifier = factoryDeclaration.getImportDeclaration().getModuleSpecifierValue();
        return (
          (importedName === "createApp" && moduleSpecifier === "@croco/transports-http") ||
          (importedName === "createCrocoApp" && moduleSpecifier.startsWith("."))
        );
      }) === true
  );
}

function isListenCallOnReceiver(call: CallExpression, appVariable: VariableDeclaration): boolean {
  const expression = call.getExpression();
  if (!Node.isPropertyAccessExpression(expression) || expression.getName() !== "listen") {
    return false;
  }

  const receiver = expression.getExpression();
  return Node.isIdentifier(receiver) && receiver.getSymbol() === appVariable.getSymbol();
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

function reconcileImport(
  sourceFile: SourceFile,
  importPath: string,
  className: string,
  registeredIdentifier: Identifier,
): ImportUpdateResult {
  const importDeclarations = sourceFile
    .getImportDeclarations()
    .filter((declaration) => declaration.getModuleSpecifierValue() === importPath);

  let localImportCount = 0;
  let hasExpectedImport = false;
  for (const declaration of sourceFile.getImportDeclarations()) {
    if (declaration.getDefaultImport()?.getText() === className) {
      localImportCount += 1;
    }

    if (declaration.getNamespaceImport()?.getText() === className) {
      localImportCount += 1;
    }

    for (const namedImport of declaration.getNamedImports()) {
      const localName = namedImport.getAliasNode()?.getText() ?? namedImport.getName();
      if (localName !== className) continue;

      localImportCount += 1;
      hasExpectedImport =
        hasExpectedImport ||
        (!declaration.isTypeOnly() &&
          !namedImport.isTypeOnly() &&
          namedImport.getName() === className &&
          declaration.getModuleSpecifierValue() === importPath);
    }
  }

  const bindingDeclarations = [
    ...(sourceFile.getLocal(className)?.getDeclarations() ?? []),
    ...(registeredIdentifier.getSymbol()?.getDeclarations() ?? []),
  ];
  const hasNonImportDeclaration = bindingDeclarations.some(
    (declaration) => !declaration.getFirstAncestorByKind(SyntaxKind.ImportDeclaration),
  );

  if (localImportCount > 0) {
    return localImportCount === 1 && hasExpectedImport && !hasNonImportDeclaration
      ? "updated-idempotent"
      : "conflicting-binding";
  }

  if (hasNonImportDeclaration) {
    return "conflicting-binding";
  }

  const importDeclaration = importDeclarations.find(
    (declaration) => !declaration.isTypeOnly() && !declaration.getNamespaceImport(),
  );

  if (!importDeclaration) {
    sourceFile.addImportDeclaration({
      namedImports: [className],
      moduleSpecifier: importPath,
    });
  } else {
    importDeclaration.addNamedImport(className);
  }

  return "updated";
}
