import { join } from "node:path";
import { mergeInto } from "../helpers/fs.js";
import { TEMPLATES_DIR } from "../template-path.js";
import type { GeneratorOptions } from "../types.js";

export function installWebTrpc(
  targetDir: string,
  webAppName: string,
  options: Pick<GeneratorOptions, "projectName" | "scope">,
): void {
  const addonDir = join(TEMPLATES_DIR, "addons/web-trpc/apps/web");
  const appTargetDir = join(targetDir, "apps", webAppName);
  mergeInto(addonDir, appTargetDir, { projectName: options.projectName, scope: options.scope });
}
