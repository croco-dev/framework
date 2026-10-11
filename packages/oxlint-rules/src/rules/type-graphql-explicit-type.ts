import type { Rule } from "eslint";
import type { CallExpression, Expression, Node } from "estree";
import { resolveDecoratorBinding } from "./decorator-binding.ts";

const TYPE_GRAPHQL_MODULE = "type-graphql";
const TYPE_GRAPHQL_FACADE_MODULE = "@croco/protocols-graphql";
const TARGET_DECORATORS = new Set(["Field", "Query", "Mutation"]);

type DecoratorNode = Node & {
  readonly expression: Expression;
};

const isDecoratorCall = (
  expression: Expression,
): expression is CallExpression & { callee: { readonly type: string } } => {
  return expression.type === "CallExpression";
};

const rule: Rule.RuleModule = {
  meta: {
    type: "problem",
    docs: {
      description: "Require explicit type argument in TypeGraphQL decorators",
    },
    messages: {
      missingTypeArg:
        "{{decoratorName}} decorator requires an explicit type argument (e.g. () => String).",
    },
    schema: [],
  },
  create(context) {
    return {
      Decorator(node: DecoratorNode) {
        const binding = resolveDecoratorBinding(
          context,
          node as unknown as Record<string, unknown>,
          {
            moduleSpecifier: [TYPE_GRAPHQL_MODULE, TYPE_GRAPHQL_FACADE_MODULE],
            targetNames: TARGET_DECORATORS,
          },
        );

        if (!binding || !isDecoratorCall(node.expression)) {
          return;
        }

        const [typeArgument] = node.expression.arguments;
        if (typeArgument && typeArgument.type !== "ObjectExpression") {
          return;
        }

        context.report({
          node,
          messageId: "missingTypeArg",
          data: {
            decoratorName: `@${binding.importedName}`,
          },
        });
      },
    };
  },
};

export default rule;
