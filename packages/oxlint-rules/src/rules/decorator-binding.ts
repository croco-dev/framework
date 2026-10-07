import type { Rule } from "eslint";

export type DecoratorBinding = {
  readonly importedName: string;
  readonly moduleSpecifier: string;
};

type ResolveOptions = {
  readonly moduleSpecifier: string | readonly string[];
  readonly targetNames: ReadonlySet<string>;
};

type ScopeLike = {
  readonly upper: ScopeLike | null;
  readonly set: Map<string, VariableLike>;
};

type VariableLike = {
  readonly defs: readonly DefinitionLike[];
};

type DefinitionLike = {
  readonly type: string;
  readonly node: Record<string, unknown>;
};

type CalleeReference =
  | { readonly kind: "identifier"; readonly localName: string; readonly displayName: string }
  | {
      readonly kind: "member";
      readonly objectName: string;
      readonly propertyName: string;
      readonly displayName: string;
    };

const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null;
};

const asType = (node: Record<string, unknown>): string | null => {
  return typeof node.type === "string" ? node.type : null;
};

const readName = (node: unknown): string | null => {
  if (!isObject(node)) {
    return null;
  }

  if (typeof node.name === "string") {
    return node.name;
  }

  if (typeof node.value === "string") {
    return node.value;
  }

  return null;
};

const readModuleSpecifier = (parent: Record<string, unknown>): string | null => {
  if (asType(parent) !== "ImportDeclaration") {
    return null;
  }

  if (!isObject(parent.source)) {
    return null;
  }

  return typeof parent.source.value === "string" ? parent.source.value : null;
};

const matchesModuleSpecifier = (
  parent: Record<string, unknown>,
  specifiers: string | readonly string[],
): boolean => {
  const actual = readModuleSpecifier(parent);

  return (
    typeof actual === "string" &&
    (typeof specifiers === "string" ? actual === specifiers : specifiers.includes(actual))
  );
};

const readImportSpecifierName = (node: Record<string, unknown>): string | null => {
  if (!isObject(node.imported)) {
    return null;
  }

  return readName(node.imported);
};

const getCalleeReference = (expression: Record<string, unknown>): CalleeReference | null => {
  if (asType(expression) !== "CallExpression" || !isObject(expression.callee)) {
    return null;
  }

  const callee = expression.callee;
  const calleeType = asType(callee);

  if (
    calleeType === "Identifier" ||
    calleeType === "IdentifierReference" ||
    calleeType === "IdentifierName" ||
    calleeType === "BindingIdentifier"
  ) {
    const localName = readName(callee);

    return localName ? { kind: "identifier", localName, displayName: `@${localName}` } : null;
  }

  if (
    calleeType === "MemberExpression" ||
    calleeType === "StaticMemberExpression" ||
    calleeType === "ComputedMemberExpression"
  ) {
    if (!isObject(callee.object) || !isObject(callee.property)) {
      return null;
    }

    const isComputed = calleeType === "ComputedMemberExpression" || callee.computed === true;

    if (isComputed && typeof callee.property.value !== "string") {
      return null;
    }

    const objectName = readName(callee.object);
    const propertyName = readName(callee.property);

    if (!objectName || !propertyName) {
      return null;
    }

    return {
      kind: "member",
      objectName,
      propertyName,
      displayName: `@${objectName}.${propertyName}`,
    };
  }

  return null;
};

const getScope = (context: Rule.RuleContext, node: Record<string, unknown>): ScopeLike | null => {
  const sourceCode = (context as unknown as { sourceCode?: unknown }).sourceCode;

  if (isObject(sourceCode)) {
    const getScopeFn = sourceCode.getScope;

    if (typeof getScopeFn === "function") {
      const scope = (getScopeFn as (node: unknown) => unknown).call(sourceCode, node);

      if (isObject(scope) && scope.set instanceof Map) {
        return scope as unknown as ScopeLike;
      }
    }
  }

  const legacyGetScope = (context as unknown as { getScope?: unknown }).getScope;

  if (typeof legacyGetScope === "function") {
    const scope = (legacyGetScope as () => unknown)();

    if (isObject(scope) && scope.set instanceof Map) {
      return scope as unknown as ScopeLike;
    }
  }

  return null;
};

const findVariable = (scope: ScopeLike | null, name: string): VariableLike | null => {
  let current: ScopeLike | null = scope;

  while (current) {
    const variable = current.set.get(name);

    if (variable) {
      return variable;
    }

    current = current.upper;
  }

  return null;
};

export const resolveDecoratorBinding = (
  context: Rule.RuleContext,
  decoratorNode: Record<string, unknown>,
  options: ResolveOptions,
): DecoratorBinding | null => {
  if (!isObject(decoratorNode.expression)) {
    return null;
  }

  const callee = getCalleeReference(decoratorNode.expression);

  if (!callee) {
    return null;
  }

  const scope = getScope(context, decoratorNode);

  if (!scope) {
    return null;
  }

  if (callee.kind === "identifier") {
    const variable = findVariable(scope, callee.localName);

    if (!variable) {
      return null;
    }

    const [definition] = variable.defs;

    if (!definition || definition.type !== "ImportBinding" || !isObject(definition.node)) {
      return null;
    }

    if (asType(definition.node) !== "ImportSpecifier" || !isObject(definition.node.parent)) {
      return null;
    }

    if (!matchesModuleSpecifier(definition.node.parent, options.moduleSpecifier)) {
      return null;
    }

    const importedName = readImportSpecifierName(definition.node);

    if (!importedName || !options.targetNames.has(importedName)) {
      return null;
    }

    const moduleSpecifier = readModuleSpecifier(definition.node.parent);

    if (!moduleSpecifier) {
      return null;
    }

    return { importedName, moduleSpecifier };
  }

  const variable = findVariable(scope, callee.objectName);

  if (!variable) {
    return null;
  }

  const [definition] = variable.defs;

  if (!definition || definition.type !== "ImportBinding" || !isObject(definition.node)) {
    return null;
  }

  if (asType(definition.node) !== "ImportNamespaceSpecifier" || !isObject(definition.node.parent)) {
    return null;
  }

  if (!matchesModuleSpecifier(definition.node.parent, options.moduleSpecifier)) {
    return null;
  }

  if (!options.targetNames.has(callee.propertyName)) {
    return null;
  }

  const moduleSpecifier = readModuleSpecifier(definition.node.parent);

  if (!moduleSpecifier) {
    return null;
  }

  return { importedName: callee.propertyName, moduleSpecifier };
};
