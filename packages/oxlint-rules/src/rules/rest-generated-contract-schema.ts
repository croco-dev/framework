import type { Rule } from "eslint";
import type { CallExpression, Expression, Literal, Node } from "estree";
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

const isStringLiteral = (node: Node | undefined): node is Literal & { value: string } => {
  return node?.type === "Literal" && typeof node.value === "string";
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
