import ts from "typescript";

/** Inspect module references without interpreting schema strings or comments as code. */
export function hasZodModuleReference(content: string): boolean {
  const source = ts.createSourceFile(
    "client.ts",
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

  function isZodModule(node: ts.Node | undefined): boolean {
    return (
      node !== undefined &&
      ts.isStringLiteralLike(node) &&
      (node.text === "zod" || node.text.startsWith("zod/"))
    );
  }

  function visit(node: ts.Node): boolean {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      isZodModule(node.moduleSpecifier)
    ) {
      return true;
    }
    if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference) &&
      isZodModule(node.moduleReference.expression)
    ) {
      return true;
    }
    if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      isZodModule(node.argument.literal)
    ) {
      return true;
    }
    if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === "require")) &&
      isZodModule(node.arguments[0])
    ) {
      return true;
    }
    return ts.forEachChild(node, visit) ?? false;
  }

  return visit(source);
}
