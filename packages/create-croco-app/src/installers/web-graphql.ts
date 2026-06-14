import { join } from "node:path";
import { mergeInto } from "../helpers/fs.js";
import { TEMPLATES_DIR } from "../template-path.js";
import type { GeneratorOptions } from "../types.js";

export function installWebGraphql(
  targetDir: string,
  webAppName: string,
  options: Pick<GeneratorOptions, "projectName" | "scope">,
): void {
  const addonDir = join(TEMPLATES_DIR, "addons/web-graphql");
  const appTargetDir = join(targetDir, "apps", webAppName);
  mergeInto(addonDir, appTargetDir, { projectName: options.projectName, scope: options.scope });
}
