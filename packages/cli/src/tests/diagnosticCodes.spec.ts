import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { getDiagnosticCodeDefinition, isDiagnosticCode } from "@croco/diagnostics-core";
import { CLI_DIAGNOSTIC_CODES, CLI_LEGACY_DIAGNOSTIC_CODES } from "../libs/diagnosticCodes.js";

const currentDir = dirname(fileURLToPath(import.meta.url));
const cliSrcDir = join(currentDir, "..");

describe("CLI diagnostic codes", () => {
  it("registers every CLI stable code and its legacy alias", () => {
    for (const [key, code] of Object.entries(CLI_DIAGNOSTIC_CODES)) {
      const legacyCode =
        CLI_LEGACY_DIAGNOSTIC_CODES[key as keyof typeof CLI_LEGACY_DIAGNOSTIC_CODES];
      const definition = getDiagnosticCodeDefinition(code);

      expect(isDiagnosticCode(code)).toBe(true);
      expect(definition, code).toBeDefined();
      if (legacyCode) {
        expect(definition?.legacyCodes, code).toContain(legacyCode);
      }
    }
  });

  it("keeps dynamic Project Map legacy aliases out of the static serialization table", () => {
    expect(CLI_LEGACY_DIAGNOSTIC_CODES).not.toHaveProperty("projectMapFrameworkManifestDiagnostic");
    expect(CLI_LEGACY_DIAGNOSTIC_CODES).not.toHaveProperty("projectMapContractGraphDiagnostic");
    expect(
      getDiagnosticCodeDefinition(CLI_DIAGNOSTIC_CODES.projectMapFrameworkManifestDiagnostic)
        ?.legacyCodes,
    ).toContain("project-map/framework-manifest-*");
    expect(
      getDiagnosticCodeDefinition(CLI_DIAGNOSTIC_CODES.projectMapContractGraphDiagnostic)
        ?.legacyCodes,
    ).toContain("project-map/contract-graph-*");
  });

  it("keeps static legacy aliases one-to-one", () => {
    const aliases = Object.values(CLI_LEGACY_DIAGNOSTIC_CODES);

    expect(new Set(aliases).size).toBe(aliases.length);
  });

  it("prevents primary slash-form diagnostic codes in CLI producers", () => {
    const offenders = listSourceFiles([join(cliSrcDir, "commands"), join(cliSrcDir, "libs")])
      .flatMap(findPrimarySlashCodeOffenders)
      .sort();

    expect(offenders).toEqual([]);
  });

  it("resolves imported legacy aliases while scanning primary code expressions", () => {
    const sourceFile = ts.createSourceFile(
      "LegacyProblem.ts",
      `
class LegacyProblem extends Problem {
  constructor() {
    const code = CLI_LEGACY_DIAGNOSTIC_CODES.jobsHttpError;
    super(code);
  }
}
`,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    const expression = findFirstSuperArgument(sourceFile);
    const bindings = collectStringBindings(sourceFile);
    const resolved = expression ? resolveStringExpression(expression, bindings) : undefined;

    expect(expression).toBeDefined();
    expect(bindings.identifiers.get("code")).toBe(CLI_LEGACY_DIAGNOSTIC_CODES.jobsHttpError);
    expect(resolved).toBe(CLI_LEGACY_DIAGNOSTIC_CODES.jobsHttpError);
  });
});

type StringBindings = {
  readonly identifiers: ReadonlyMap<string, string>;
  readonly propertyAccesses: ReadonlyMap<string, string>;
};

function findPrimarySlashCodeOffenders(file: string): string[] {
  const source = readFileSync(file, "utf-8");
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const bindings = collectStringBindings(sourceFile);
  const offenders: string[] = [];

  const visit = (node: ts.Node): void => {
    const primaryCodeExpression = getPrimaryCodeExpression(node);
    const code = primaryCodeExpression
      ? resolveStringExpression(primaryCodeExpression, bindings)
      : undefined;

    if (primaryCodeExpression && code && isSlashFormDiagnosticCode(code)) {
      const { line } = sourceFile.getLineAndCharacterOfPosition(
        primaryCodeExpression.getStart(sourceFile),
      );
      offenders.push(`${file}:${line + 1} ${code}`);
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  return offenders;
}

function getPrimaryCodeExpression(node: ts.Node): ts.Expression | undefined {
  if (
    ts.isPropertyAssignment(node) &&
    getPropertyNameText(node.name) === "code" &&
    ts.isExpression(node.initializer)
  ) {
    return node.initializer;
  }

  if (
    ts.isPropertyDeclaration(node) &&
    getPropertyNameText(node.name) === "code" &&
    node.initializer
  ) {
    return node.initializer;
  }

  if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.SuperKeyword) {
    return node.arguments[0];
  }

  return undefined;
}

function findFirstSuperArgument(sourceFile: ts.SourceFile): ts.Expression | undefined {
  let expression: ts.Expression | undefined;

  const visit = (node: ts.Node): void => {
    if (expression) {
      return;
    }

    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.SuperKeyword) {
      expression = node.arguments[0];
      return;
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  return expression;
}

function collectStringBindings(sourceFile: ts.SourceFile): StringBindings {
  const identifiers = new Map<string, string>();
  const propertyAccesses = new Map<string, string>();

  const visit = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const initializer = unwrapExpression(node.initializer);
      const value =
        readStringLiteral(initializer) ??
        resolveStringExpression(initializer, { identifiers, propertyAccesses });

      if (value) {
        identifiers.set(node.name.text, value);
      }

      if (ts.isObjectLiteralExpression(initializer)) {
        for (const property of initializer.properties) {
          if (!ts.isPropertyAssignment(property)) {
            continue;
          }

          const propertyName = getPropertyNameText(property.name);
          const propertyValue = readStringLiteral(unwrapExpression(property.initializer));

          if (propertyName && propertyValue) {
            propertyAccesses.set(`${node.name.text}.${propertyName}`, propertyValue);
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  return { identifiers, propertyAccesses };
}

function resolveStringExpression(
  expression: ts.Expression,
  bindings: StringBindings,
): string | undefined {
  const unwrapped = unwrapExpression(expression);
  const literal = readStringLiteral(unwrapped);

  if (literal) {
    return literal;
  }

  if (ts.isIdentifier(unwrapped)) {
    return bindings.identifiers.get(unwrapped.text);
  }

  if (ts.isPropertyAccessExpression(unwrapped)) {
    return (
      resolveImportedLegacyDiagnosticCode(unwrapped) ??
      bindings.propertyAccesses.get(unwrapped.getText())
    );
  }

  return undefined;
}

function resolveImportedLegacyDiagnosticCode(
  expression: ts.PropertyAccessExpression,
): string | undefined {
  if (
    !ts.isIdentifier(expression.expression) ||
    expression.expression.text !== "CLI_LEGACY_DIAGNOSTIC_CODES"
  ) {
    return undefined;
  }

  return CLI_LEGACY_DIAGNOSTIC_CODES[
    expression.name.text as keyof typeof CLI_LEGACY_DIAGNOSTIC_CODES
  ];
}

function unwrapExpression(expression: ts.Expression): ts.Expression {
  let current = expression;

  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isSatisfiesExpression(current)
  ) {
    current = current.expression;
  }

  return current;
}

function readStringLiteral(expression: ts.Expression): string | undefined {
  return ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)
    ? expression.text
    : undefined;
}

function getPropertyNameText(name: ts.PropertyName): string | undefined {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }

  return undefined;
}

function isSlashFormDiagnosticCode(code: string): boolean {
  return /^[a-z0-9-]+\/[a-z0-9_./:-]+$/u.test(code);
}

function listSourceFiles(roots: readonly string[]): string[] {
  return roots.flatMap((root) => listSourceFilesInDir(root));
}

function listSourceFilesInDir(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return listSourceFilesInDir(path);
    }

    return entry.isFile() && path.endsWith(".ts") ? [path] : [];
  });
}
