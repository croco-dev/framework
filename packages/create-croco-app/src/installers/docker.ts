import { join } from "node:path";
import { mergeInto } from "../helpers/fs.js";
import type { GeneratorOptions } from "../types.js";

const TEMPLATES_DIR = new URL("../../templates", import.meta.url).pathname;

export function installDocker(
  targetDir: string,
  options: Pick<GeneratorOptions, "projectName" | "scope" | "api">,
): void {
  const addonDir = join(TEMPLATES_DIR, "addons/docker");
  mergeInto(addonDir, targetDir, { projectName: options.projectName, scope: options.scope });
}
