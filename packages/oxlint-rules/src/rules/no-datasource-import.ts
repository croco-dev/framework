import path from "node:path";
import type { Rule } from "eslint";
import type { ImportDeclaration, ExportNamedDeclaration, ExportAllDeclaration } from "estree";

const RESTRICTED_LAYERS = ["domain", "service", "application"] as const;

type RestrictedLayer = (typeof RESTRICTED_LAYERS)[number];

const getLibPathRest = (filePath: string): string | null => {
  const match = filePath.replace(/\\/g, "/").match(/(?:^|\/)libs\/[^/]+(?:\/(.*))?$/);

  if (!match) {
    return null;
  }

  return match[1] ?? "";
};

const getRestrictedLayer = (pathRest: string): RestrictedLayer | null => {
  const segments = pathRest.split("/");
  for (const layer of RESTRICTED_LAYERS) {
    if (segments.includes(layer)) {
      return layer;
    }
  }

  return null;
};

const isDatasourcePath = (pathRest: string): boolean => pathRest.split("/").includes("datasource");

const rule: Rule.RuleModule = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow importing datasource from domain/service/application layers",
    },
    messages: {
      noDatasourceImport: "Datasource layer cannot be imported from {{layer}} layer.",
    },
    schema: [],
  },
  create(context) {
    const checkSource = (
      node: ImportDeclaration | ExportNamedDeclaration | ExportAllDeclaration,
    ): void => {
      const sourceValue = node.source?.value;
      if (typeof sourceValue !== "string" || !sourceValue.startsWith(".")) {
        return;
      }

      const sourceRest = getLibPathRest(context.filename);
      if (!sourceRest) {
        return;
      }

      const currentLayer = getRestrictedLayer(sourceRest);
      if (!currentLayer) {
        return;
      }

      const targetPath = path.resolve(path.dirname(context.filename), sourceValue);
      const targetRest = getLibPathRest(targetPath);

      if (!targetRest || !isDatasourcePath(targetRest)) {
        return;
      }

      context.report({
        node,
        messageId: "noDatasourceImport",
        data: {
          layer: currentLayer,
        },
      });
    };

    return {
      ImportDeclaration: checkSource,
      ExportNamedDeclaration: checkSource,
      ExportAllDeclaration: checkSource,
    };
  },
};

export default rule;
