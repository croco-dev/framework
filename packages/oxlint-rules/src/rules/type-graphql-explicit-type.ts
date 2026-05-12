import type { Rule } from "eslint";
import type { CallExpression, Expression, Identifier, Node } from "estree";

const TARGET_DECORATORS = new Set(["Field", "Query", "Mutation"]);

type DecoratorNode = Node & {
  readonly expression: Expression;
};

const isTargetDecoratorCall = (
  expression: Expression,
): expression is CallExpression & { callee: Identifier } => {
  if (expression.type !== "CallExpression") {
    return false;
  }

  if (expression.callee.type !== "Identifier") {
    return false;
  }

  return TARGET_DECORATORS.has(expression.callee.name);
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
        if (!isTargetDecoratorCall(node.expression)) {
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
            decoratorName: `@${node.expression.callee.name}`,
          },
        });
      },
    };
  },
};

export default rule;
