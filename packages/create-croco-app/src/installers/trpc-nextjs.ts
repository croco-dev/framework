import { join } from "node:path";
import { mergeInto } from "../helpers/fs.js";
import { TEMPLATES_DIR } from "../template-path.js";
import type { GeneratorOptions } from "../types.js";

export function installTrpcNextjs(
  targetDir: string,
  options: Pick<GeneratorOptions, "projectName" | "scope">,
): void {
  const addonDir = join(TEMPLATES_DIR, "addons/trpc-nextjs");
  mergeInto(addonDir, targetDir, {
    projectName: options.projectName,
    scope: options.scope,
  });
}
