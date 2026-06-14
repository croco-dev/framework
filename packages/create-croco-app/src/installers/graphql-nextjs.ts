import { join } from "node:path";
import { mergeInto } from "../helpers/fs.js";
import { TEMPLATES_DIR } from "../template-path.js";
import type { GeneratorOptions } from "../types.js";

export function installGraphqlNextjs(
  targetDir: string,
  options: Pick<GeneratorOptions, "projectName" | "scope">,
): void {
  const addonDir = join(TEMPLATES_DIR, "addons/graphql-nextjs");
  mergeInto(addonDir, targetDir, {
    projectName: options.projectName,
    scope: options.scope,
  });
}
