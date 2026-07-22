import { join } from "node:path";
import { mergeInto } from "../helpers/fs.js";
import { mergePackageJson } from "../helpers/pkg-json.js";
import { TEMPLATES_DIR } from "../template-path.js";
import type { GeneratorOptions } from "../types.js";

export function installLambda(
  targetDir: string,
  options: Pick<GeneratorOptions, "projectName" | "scope" | "api">,
): void {
  const addonDir = join(TEMPLATES_DIR, "addons/lambda");
  mergeInto(addonDir, targetDir, {
    projectName: options.projectName,
    scope: options.scope,
    handlerPath:
      options.api === "graphql"
        ? "apps/graphql-api/src/handler.handler"
        : "apps/api/src/handler.handler",
  });

  if (options.api === "graphql") {
    mergePackageJson(join(targetDir, "apps", "graphql-api"), {
      dependencies: {
        "@as-integrations/aws-lambda": "^3.1.0",
        "@croco/problems-core": "workspace:*",
      },
      devDependencies: {
        "@types/aws-lambda": "^8.10.146",
      },
    });
  }
}
