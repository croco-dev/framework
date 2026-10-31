import ts from "typescript";

export const TEST_CLOCK_RECOVERY =
  "Create every fixture instance through its bound factory and pass the shared clock/scheduler explicitly. Reserve a reasoned next-line real-time exception for native lifecycle checks.";

export type TestClockFinding = {
  readonly node: ts.Node;
  readonly message: string;
};

export function isControlledTestClockSource(file: string, source: string): boolean {
  const testSource =
    /(?:^|\/)(?:tests|__tests__|fixtures)\//.test(file) ||
    /\.(?:spec|test)\.[cm]?[jt]sx?$/.test(file);
  return (
    testSource &&
    (ts.getLeadingCommentRanges(source, 0) ?? []).some(
      (comment) =>
        comment.kind === ts.SyntaxKind.SingleLineCommentTrivia &&
        /^\/\/\s*croco-test-clock:\s*controlled\s*$/.test(source.slice(comment.pos, comment.end)),
    )
  );
}

export function detectTestClockFindings(
  sourceFile: ts.SourceFile,
  checker: ts.TypeChecker,
): readonly TestClockFinding[] {
  const findings: TestClockFinding[] = [];
  const lines = sourceFile.text.split(/\r?\n/);
  const realTimeExpressions = new Set<ts.Expression>();

  function report(node: ts.Node, message: string): void {
    findings.push({ node, message });
  }

  function reportAmbient(node: ts.Expression, message: string): void {
    const owner = immediateExpressionOwner(node);
    if (owner && !realTimeExpressions.has(owner.expression)) {
      const start = sourceFile.getLineAndCharacterOfPosition(owner.anchor.getStart(sourceFile));
      const prefix = (lines[start.line] ?? "").slice(0, start.character);
      if (
        /^\s*$/.test(prefix) &&
        /^\s*\/\/\s*croco-test-clock-real-time\s+--\s+\S.*$/.test(lines[start.line - 1] ?? "")
      ) {
        realTimeExpressions.add(owner.expression);
        return;
      }
    }
    report(node, message);
  }

  function visit(node: ts.Node): void {
    if (ts.isNewExpression(node) && isGlobalDate(node.expression, checker)) {
      if (!node.arguments?.length)
        reportAmbient(node, "Ambient new Date() escapes the controlled fixture clock.");
    } else if (ts.isCallExpression(node) && isGlobalDate(node.expression, checker)) {
      reportAmbient(node, "Ambient Date() escapes the controlled fixture clock.");
    } else if (
      ts.isCallExpression(node) &&
      literalPropertyAccess(node.expression)?.name === "now" &&
      isGlobalDate(literalPropertyAccess(node.expression)?.receiver, checker)
    ) {
      reportAmbient(node, "Ambient Date.now() escapes the controlled fixture clock.");
    }

    if (ts.isNewExpression(node)) {
      const signature = checker.getResolvedSignature(node);
      signature?.parameters.forEach((parameter, index) => {
        const parameterType = checker.getTypeOfSymbolAtLocation(parameter, node);
        const argument = node.arguments?.[index];
        if (isTemporalSeam(parameter.name, parameterType, checker)) {
          if (!argument || mayBeUndefined(checker.getTypeAtLocation(argument))) {
            report(
              argument ?? node,
              `Constructor '${node.expression.getText(sourceFile)}' must receive its fixture '${parameter.name}' explicitly.`,
            );
          }
          return;
        }

        const alternatives = typeAlternatives(parameterType, checker);
        if (alternatives.length > 1) {
          const branches = alternatives.map((type) => ({
            type,
            seams: temporalProperties(type, node, checker),
          }));
          if (!branches.some(({ seams }) => seams.length > 0)) return;
          if (
            !argument ||
            mayBeUndefined(checker.getTypeAtLocation(argument)) ||
            typeAlternatives(checker.getTypeAtLocation(argument), checker).some(
              (suppliedType) =>
                !branches.some(
                  ({ type, seams }) =>
                    checker.isTypeAssignableTo(suppliedType, type) &&
                    seams.every((property) =>
                      hasExplicitProperty(suppliedType, property.name, argument, checker),
                    ),
                ),
            )
          ) {
            report(
              argument ?? node,
              `Constructor '${node.expression.getText(sourceFile)}' must receive a complete clock/scheduler options alternative from its controlled fixture.`,
            );
          }
          return;
        }

        const options = checker.getNonNullableType(parameterType);
        for (const property of checker.getPropertiesOfType(options)) {
          const propertyType = checker.getTypeOfSymbolAtLocation(property, node);
          if (!isTemporalSeam(property.name, propertyType, checker)) continue;
          if (
            !argument ||
            mayBeUndefined(checker.getTypeAtLocation(argument)) ||
            !hasExplicitProperty(
              checker.getTypeAtLocation(argument),
              property.name,
              argument,
              checker,
            )
          ) {
            report(
              argument ?? node,
              `Constructor '${node.expression.getText(sourceFile)}' must receive options.${property.name} from its controlled fixture.`,
            );
          }
        }
      });
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return findings;
}

function isTemporalSeam(name: string, type: ts.Type, checker: ts.TypeChecker): boolean {
  const value = checker.getNonNullableType(type);
  if (value.isUnion())
    return value.types.some((alternative) => isTemporalSeam(name, alternative, checker));
  if (name === "scheduler" || name === "schedule") return value.getCallSignatures().length > 0;
  if (name !== "clock" && name !== "now") return false;
  if (isClockCallback(value, checker)) return true;
  if (name !== "clock") return false;
  const now = checker.getPropertyOfType(value, "now");
  const declaration = now?.valueDeclaration ?? now?.declarations?.[0];
  return (
    !!now &&
    !!declaration &&
    isClockCallback(checker.getTypeOfSymbolAtLocation(now, declaration), checker)
  );
}

function isClockCallback(type: ts.Type, checker: ts.TypeChecker): boolean {
  return checker
    .getNonNullableType(type)
    .getCallSignatures()
    .some((signature) => {
      if (signature.parameters.length !== 0) return false;
      const result = checker.getReturnTypeOfSignature(signature);
      return (
        (result.flags & ts.TypeFlags.NumberLike) !== 0 || checker.typeToString(result) === "Date"
      );
    });
}

function mayBeUndefined(type: ts.Type): boolean {
  return (
    (type.flags &
      (ts.TypeFlags.Undefined | ts.TypeFlags.Void | ts.TypeFlags.Any | ts.TypeFlags.Unknown)) !==
      0 ||
    (type.isUnion() && type.types.some(mayBeUndefined))
  );
}

function typeAlternatives(type: ts.Type, checker: ts.TypeChecker): readonly ts.Type[] {
  const value = checker.getNonNullableType(type);
  return value.isUnion() ? value.types : [value];
}

function temporalProperties(
  type: ts.Type,
  location: ts.Node,
  checker: ts.TypeChecker,
): readonly ts.Symbol[] {
  return checker
    .getPropertiesOfType(type)
    .filter((property) =>
      isTemporalSeam(property.name, checker.getTypeOfSymbolAtLocation(property, location), checker),
    );
}

function hasExplicitProperty(
  type: ts.Type,
  name: string,
  location: ts.Node,
  checker: ts.TypeChecker,
): boolean {
  const property = checker.getPropertyOfType(checker.getNonNullableType(type), name);
  return (
    !!property &&
    (property.flags & ts.SymbolFlags.Optional) === 0 &&
    !mayBeUndefined(checker.getTypeOfSymbolAtLocation(property, location))
  );
}

function literalPropertyAccess(
  expression: ts.Expression,
): { readonly receiver: ts.Expression; readonly name: string } | undefined {
  if (ts.isPropertyAccessExpression(expression))
    return { receiver: expression.expression, name: expression.name.text };
  if (
    ts.isElementAccessExpression(expression) &&
    ts.isStringLiteralLike(expression.argumentExpression)
  ) {
    return { receiver: expression.expression, name: expression.argumentExpression.text };
  }
  return undefined;
}

function isGlobalDate(expression: ts.Expression | undefined, checker: ts.TypeChecker): boolean {
  if (!expression) return false;
  let symbol: ts.Symbol | undefined;
  if (ts.isIdentifier(expression)) {
    if (expression.text !== "Date") return false;
    symbol = checker.getSymbolAtLocation(expression);
  } else {
    const access = literalPropertyAccess(expression);
    if (access?.name !== "Date") return false;
    symbol = checker.getPropertyOfType(checker.getTypeAtLocation(access.receiver), "Date");
  }
  return (
    symbol?.declarations?.some((declaration) =>
      /(?:^|\/)lib\.[^/]+\.d\.ts$/.test(declaration.getSourceFile().fileName),
    ) ?? false
  );
}

function immediateExpressionOwner(
  node: ts.Expression,
): { readonly expression: ts.Expression; readonly anchor: ts.Node } | undefined {
  let current: ts.Node = node;
  while (current.parent && !ts.isStatement(current)) {
    if (ts.isFunctionLike(current.parent)) return undefined;
    if (ts.isVariableDeclaration(current.parent) && current.parent.initializer) {
      const declaration = current.parent;
      const expression = declaration.initializer;
      if (!expression) return undefined;
      if (
        !ts.isVariableDeclarationList(declaration.parent) ||
        declaration.parent.declarations[0] !== declaration
      )
        return undefined;
      const statement = declaration.parent.parent;
      if (!ts.isVariableStatement(statement)) return undefined;
      return { expression, anchor: statement };
    }
    current = current.parent;
  }
  if (ts.isExpressionStatement(current)) return { expression: current.expression, anchor: current };
  if (ts.isReturnStatement(current) && current.expression)
    return { expression: current.expression, anchor: current };
  return undefined;
}
