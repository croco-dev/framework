import type { Rule } from "eslint";
import type {
  CallExpression,
  Expression,
  Identifier,
  ImportDeclaration,
  ImportSpecifier,
  Literal,
  Node,
} from "estree";

const REST_PROTOCOLS_MODULE = "@croco/protocols-rest";
const NAMED_PARAMETER_DECORATORS = new Set(["Param", "Query", "Header"]);
const REST_CONTRACT_DECORATORS = new Set(["All", "Body", ...NAMED_PARAMETER_DECORATORS]);

type DecoratorNode = Node & {
  readonly expression: Expression;
};

const isDecoratorCall = (
  expression: Expression,
): expression is CallExpression & { callee: Identifier } => {
  return expression.type === "CallExpression" && expression.callee.type === "Identifier";
};

const isStringLiteral = (node: Node | undefined): node is Literal & { value: string } => {
  return node?.type === "Literal" && typeof node.value === "string";
};

const isRestProtocolImport = (node: ImportDeclaration): boolean => {
  return node.source.type === "Literal" && node.source.value === REST_PROTOCOLS_MODULE;
};

const getRestDecoratorImport = (
  specifier: ImportSpecifier,
): { readonly importedName: string; readonly localName: string } | null => {
  if (specifier.imported.type !== "Identifier") {
    return null;
  }

  return REST_CONTRACT_DECORATORS.has(specifier.imported.name)
    ? { importedName: specifier.imported.name, localName: specifier.local.name }
    : null;
};

const rule: Rule.RuleModule = {
  meta: {
    type: "problem",
    docs: {
      description: "Require generated REST contract decorators to use concrete methods and schemas",
    },
    messages: {
      allRoute:
        "@All cannot be used in generated REST contract routes. Use explicit HTTP method decorators.",
      bodySchema: "@Body() in generated REST contract routes must include a schema.",
      namedParamSchema:
        "Named REST parameter decorators in generated contract routes must include a schema.",
    },
    schema: [],
  },
  create(context) {
    const restDecoratorNames = new Map<string, string>();

    return {
      ImportDeclaration(node: ImportDeclaration) {
        if (!isRestProtocolImport(node)) {
          return;
        }

        for (const specifier of node.specifiers) {
          if (specifier.type !== "ImportSpecifier") {
            continue;
          }

          const restDecoratorImport = getRestDecoratorImport(specifier);
          if (restDecoratorImport) {
            restDecoratorNames.set(restDecoratorImport.localName, restDecoratorImport.importedName);
          }
        }
      },
      Decorator(node: DecoratorNode) {
        if (!isDecoratorCall(node.expression)) {
          return;
        }

        const decoratorName = node.expression.callee.name;
        const importedDecoratorName = restDecoratorNames.get(decoratorName);
        if (!importedDecoratorName) {
          return;
        }

        if (importedDecoratorName === "All") {
          context.report({
            node,
            messageId: "allRoute",
          });
          return;
        }

        if (importedDecoratorName === "Body" && node.expression.arguments.length === 0) {
          context.report({
            node,
            messageId: "bodySchema",
          });
          return;
        }

        if (
          NAMED_PARAMETER_DECORATORS.has(importedDecoratorName) &&
          isStringLiteral(node.expression.arguments[0]) &&
          node.expression.arguments.length === 1
        ) {
          context.report({
            node,
            messageId: "namedParamSchema",
          });
        }
      },
    };
  },
};

export default rule;
