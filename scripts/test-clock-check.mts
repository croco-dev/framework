import ts from "typescript";

export const TEST_CLOCK_DIAGNOSTIC = "CROCO_STATIC_TEST_CLOCK_BOUNDARY";
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

  function report(node: ts.Node, message: string): void {
    const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line;
    if (/^\s*\/\/\s*croco-test-clock-real-time\s+--\s+\S.*$/.test(lines[line - 1] ?? "")) return;
    findings.push({ node, message });
  }

  function visit(node: ts.Node): void {
    if (ts.isNewExpression(node) && isGlobalDate(node.expression, checker)) {
      if (!node.arguments?.length)
        report(node, "Ambient new Date() escapes the controlled fixture clock.");
    } else if (ts.isCallExpression(node) && isGlobalDate(node.expression, checker)) {
      report(node, "Ambient Date() escapes the controlled fixture clock.");
    } else if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "now" &&
      isGlobalDate(node.expression.expression, checker)
    ) {
      report(node, "Ambient Date.now() escapes the controlled fixture clock.");
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

        const options = checker.getNonNullableType(parameterType);
        for (const property of checker.getPropertiesOfType(options)) {
          const propertyType = checker.getTypeOfSymbolAtLocation(property, node);
          if (!isTemporalSeam(property.name, propertyType, checker)) continue;
          const supplied = argument
            ? checker.getPropertyOfType(
                checker.getNonNullableType(checker.getTypeAtLocation(argument)),
                property.name,
              )
            : undefined;
          if (
            !argument ||
            mayBeUndefined(checker.getTypeAtLocation(argument)) ||
            !supplied ||
            (supplied.flags & ts.SymbolFlags.Optional) !== 0 ||
            mayBeUndefined(checker.getTypeOfSymbolAtLocation(supplied, argument))
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

function isGlobalDate(expression: ts.Expression, checker: ts.TypeChecker): boolean {
  const name = ts.isIdentifier(expression)
    ? expression
    : ts.isPropertyAccessExpression(expression)
      ? expression.name
      : undefined;
  if (!name || name.text !== "Date") return false;
  const symbol = checker.getSymbolAtLocation(name);
  return (
    symbol?.declarations?.some((declaration) =>
      /(?:^|\/)lib\.[^/]+\.d\.ts$/.test(declaration.getSourceFile().fileName),
    ) ?? false
  );
}
