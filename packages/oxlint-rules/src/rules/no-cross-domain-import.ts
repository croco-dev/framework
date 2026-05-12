import path from "node:path";
import type { Rule } from "eslint";

const DATASOURCE_SEGMENT = "/datasource/";
const SHARED_DOMAIN = "shared";

const isDatasourcePath = (pathRest: string): boolean =>
  pathRest.startsWith("src/datasource/") || pathRest.includes(DATASOURCE_SEGMENT);

const getLibPathParts = (filePath: string): readonly [string, string] | null => {
  const match = filePath.replace(/\\/g, "/").match(/libs\/([^/]+)\/(.*)/);

  if (!match) {
    return null;
  }

  return [match[1], match[2]];
};

const rule: Rule.RuleModule = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow cross-domain imports in DDD architecture",
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
        if (typeof sourceValue !== "string" || !sourceValue.startsWith(".")) {
          return;
        }

        const sourceParts = getLibPathParts(context.filename);
        if (!sourceParts) {
          return;
        }

        const [sourceDomain, sourceRest] = sourceParts;
        const sourceIsDatasource = isDatasourcePath(sourceRest);
        const targetPath = path.resolve(path.dirname(context.filename), sourceValue);
        const targetParts = getLibPathParts(targetPath);

        if (!targetParts) {
          return;
        }

        const [targetDomain, targetRest] = targetParts;
        const targetIsDatasource = isDatasourcePath(targetRest);

        if (sourceDomain === targetDomain || targetDomain === SHARED_DOMAIN) {
          return;
        }

        if (sourceIsDatasource && targetIsDatasource) {
          return;
        }

        context.report({
          node,
          messageId: "crossDomainImport",
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
