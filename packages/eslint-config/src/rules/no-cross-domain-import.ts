import path from 'node:path';
import type { Rule } from 'eslint';

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow cross-domain imports in DDD architecture',
    },
    messages: {
      crossDomainImport:
        'Cross-domain imports are not allowed. Cannot import from "{{targetDomain}}" into "{{sourceDomain}}".',
    },
    schema: [],
  },
  create(context) {
    return {
      ImportDeclaration(node) {
        const sourceValue = node.source.value;
        if (typeof sourceValue !== 'string') return;

        // Ignore external packages (not starting with .)
        if (!sourceValue.startsWith('.')) {
          return;
        }

        const filename = context.filename.replace(/\\/g, '/');
        const libsMatch = filename.match(/libs\/([^/]+)\/(.*)/);

        if (!libsMatch) {
          return;
        }

        const sourceDomain = libsMatch[1];
        const sourceRest = libsMatch[2];
        const sourceIsDatasource = sourceRest.startsWith('src/datasource/') || sourceRest.includes('/datasource/');

        const currentDir = path.dirname(context.filename);
        const targetPath = path.resolve(currentDir, sourceValue).replace(/\\/g, '/');

        const targetLibsMatch = targetPath.match(/libs\/([^/]+)\/(.*)/);

        if (!targetLibsMatch) {
          return;
        }

        const targetDomain = targetLibsMatch[1];
        const targetRest = targetLibsMatch[2];
        const targetIsDatasource = targetRest.startsWith('src/datasource/') || targetRest.includes('/datasource/');

        if (sourceDomain === targetDomain) {
          return;
        }

        if (targetDomain === 'shared') {
          return;
        }

        if (sourceIsDatasource && targetIsDatasource) {
          return;
        }

        context.report({
          node,
          messageId: 'crossDomainImport',
          data: {
            sourceDomain,
            targetDomain,
          },
        });
      },
    };
  },
};

export default rule;
