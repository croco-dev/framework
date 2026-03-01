import type { Rule } from 'eslint';
import type { CallExpression, Identifier } from 'estree';

const TARGET_DECORATORS = new Set(['Field', 'Query', 'Mutation']);

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require explicit type argument in TypeGraphQL decorators',
    },
    messages: {
      missingTypeArg: '{{decoratorName}} decorator requires an explicit type argument (e.g. () => String).',
    },
    schema: [],
  },
  create(context) {
    return {
      // biome-ignore lint/suspicious/noExplicitAny: ESTree lacks Decorator type
      Decorator(node: any) {
        if (node.expression.type !== 'CallExpression') {
          return;
        }

        const callExpr = node.expression as CallExpression;
        if (callExpr.callee.type !== 'Identifier') {
          return;
        }

        const decoratorName = (callExpr.callee as Identifier).name;
        if (!TARGET_DECORATORS.has(decoratorName)) {
          return;
        }

        const args = callExpr.arguments;

        // If no arguments, or first argument is an ObjectExpression (options)
        if (args.length === 0 || args[0].type === 'ObjectExpression') {
          context.report({
            node,
            messageId: 'missingTypeArg',
            data: {
              decoratorName: `@${decoratorName}`,
            },
          });
        }
      },
    };
  },
};

export default rule;
