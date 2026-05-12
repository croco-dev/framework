import { join } from "node:path";
import { mergeInto } from "../helpers/fs.js";
import type { GeneratorOptions } from "../types.js";

const TEMPLATES_DIR = new URL("../../templates", import.meta.url).pathname;

export function installTrpcStandalone(
  targetDir: string,
  options: Pick<GeneratorOptions, "projectName" | "scope">,
): void {
  const addonDir = join(TEMPLATES_DIR, "addons/trpc-standalone");
  mergeInto(addonDir, targetDir, {
    projectName: options.projectName,
    scope: options.scope,
  });
}
