import path from 'node:path';
import type { Rule } from 'eslint';

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow importing datasource from domain/service/application layers',
    },
    messages: {
      noDatasourceImport: 'Datasource layer cannot be imported from {{layer}} layer.',
    },
    schema: [],
  },
  create(context) {
    return {
      ImportDeclaration(node) {
        const sourceValue = node.source.value;
        if (typeof sourceValue !== 'string') return;

        // Ignore external packages
        if (!sourceValue.startsWith('.')) {
          return;
        }

        const filename = context.filename.replace(/\\/g, '/');
        const libsMatch = filename.match(/libs\/[^/]+\/(.*)/);

        if (!libsMatch) {
          return; // Not in libs directory
        }

        const sourceRest = libsMatch[1];

        let currentLayer = '';
        if (sourceRest.startsWith('src/domain/') || sourceRest.includes('/domain/')) {
          currentLayer = 'domain';
        } else if (sourceRest.startsWith('src/service/') || sourceRest.includes('/service/')) {
          currentLayer = 'service';
        } else if (sourceRest.startsWith('src/application/') || sourceRest.includes('/application/')) {
          currentLayer = 'application';
        }

        if (!currentLayer) {
          return; // Only apply to domain, service, application layers
        }

        const currentDir = path.dirname(context.filename);
        const targetPath = path.resolve(currentDir, sourceValue).replace(/\\/g, '/');

        const targetLibsMatch = targetPath.match(/libs\/[^/]+\/(.*)/);
        if (!targetLibsMatch) {
          return;
        }

        const targetRest = targetLibsMatch[1];
        const targetIsDatasource = targetRest.startsWith('src/datasource/') || targetRest.includes('/datasource/');

        if (targetIsDatasource) {
          context.report({
            node,
            messageId: 'noDatasourceImport',
            data: {
              layer: currentLayer,
            },
          });
        }
      },
    };
  },
};

export default rule;
