import type { Rule } from "eslint";
import type { CallExpression, Expression, Node } from "estree";
import { resolveDecoratorBinding } from "./decorator-binding.ts";

const REST_PROTOCOLS_MODULE = "@croco/protocols-rest";
const NAMED_PARAMETER_DECORATORS = new Set(["Param", "Query", "Header"]);
const REST_CONTRACT_DECORATORS = new Set(["All", "Body", ...NAMED_PARAMETER_DECORATORS]);

type DecoratorNode = Node & {
  readonly expression: Expression;
};

const isDecoratorCall = (
  expression: Expression,
): expression is CallExpression & { callee: { readonly type: string } } => {
  return expression.type === "CallExpression";
};

// Oxlint preserves TypeScript wrappers around otherwise static arguments.
const unwrapArgument = (node: Node | undefined): Node | undefined => {
  const wrapped = node as (Node & { readonly expression: Node }) | undefined;
  if (
    wrapped &&
    ["TSAsExpression", "TSSatisfiesExpression", "TSTypeAssertion", "TSNonNullExpression"].includes(
      wrapped.type,
    )
  ) {
    return unwrapArgument(wrapped.expression);
  }
  return node;
};

const findVariable = (context: Rule.RuleContext, node: Node, name: string) => {
  let scope: ReturnType<typeof context.sourceCode.getScope> | null =
    context.sourceCode.getScope(node);
  while (scope) {
    const variable = scope.set.get(name);
    if (variable) return variable;
    scope = scope.upper;
  }
  return undefined;
};

const isStaticString = (
  context: Rule.RuleContext,
  argument: Node | undefined,
  visited = new Set<Node>(),
): boolean => {
  const node = unwrapArgument(argument);
  if (!node || visited.has(node)) return false;
  visited.add(node);

  if (node.type === "Literal") return typeof node.value === "string";
  if (node.type === "TemplateLiteral") return node.expressions.length === 0;
  if (node.type !== "Identifier") return false;

  const variable = findVariable(context, node, node.name);
  const definition = variable?.defs.length === 1 ? variable.defs[0] : undefined;
  if (
    definition?.type !== "Variable" ||
    definition.parent?.kind !== "const" ||
    definition.node.type !== "VariableDeclarator" ||
    definition.node.id.type !== "Identifier"
  ) {
    return false;
  }
  return isStaticString(context, definition.node.init ?? undefined, visited);
};

const isMissingSchema = (context: Rule.RuleContext, argument: Node | undefined): boolean => {
  const node = unwrapArgument(argument);
  if (!node) return true;
  if (node.type === "UnaryExpression" && node.operator === "void") return true;
  return (
    node.type === "Identifier" &&
    node.name === "undefined" &&
    !findVariable(context, node, node.name)?.defs.length
  );
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
    return {
      Decorator(node: DecoratorNode) {
        if (!isDecoratorCall(node.expression)) {
          return;
        }

        const binding = resolveDecoratorBinding(
          context,
          node as unknown as Record<string, unknown>,
          {
            moduleSpecifier: REST_PROTOCOLS_MODULE,
            targetNames: REST_CONTRACT_DECORATORS,
          },
        );

        if (!binding) {
          return;
        }

        const importedDecoratorName = binding.importedName;

        if (importedDecoratorName === "All") {
          context.report({
            node,
            messageId: "allRoute",
          });
          return;
        }

        if (
          importedDecoratorName === "Body" &&
          isMissingSchema(context, node.expression.arguments[0])
        ) {
          context.report({
            node,
            messageId: "bodySchema",
          });
          return;
        }

        if (
          NAMED_PARAMETER_DECORATORS.has(importedDecoratorName) &&
          isStaticString(context, node.expression.arguments[0]) &&
          isMissingSchema(context, node.expression.arguments[1])
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
