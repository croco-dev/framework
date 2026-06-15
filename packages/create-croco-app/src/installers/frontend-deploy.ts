import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { mergeInto, renderHandlebars } from "../helpers/fs.js";
import { TEMPLATES_DIR } from "../template-path.js";
import type { GeneratorOptions } from "../types.js";

export function installFrontendDeploy(
  targetDir: string,
  webAppName: string | undefined,
  options: Pick<GeneratorOptions, "projectName" | "scope" | "preset" | "frontendDeploy">,
): void {
  if (!options.frontendDeploy) return;

  const appTargetDir = join(targetDir, "apps", webAppName ?? "web");

  if (options.frontendDeploy === "vite-spa") {
    const addonDir = join(TEMPLATES_DIR, "addons", "frontend-vite-spa");
    mergeInto(addonDir, appTargetDir, { projectName: options.projectName, scope: options.scope });
    return;
  }

  if (options.frontendDeploy === "cloudflare-meta-vite") {
    const addonDir =
      options.preset === "ddd-vike-fullstack"
        ? join(TEMPLATES_DIR, "addons", "web-meta-vite-fullstack")
        : join(TEMPLATES_DIR, "addons", "web-meta-vite");
    const installTargetDir =
      options.preset === "ddd-vike-fullstack"
        ? targetDir
        : join(targetDir, "apps", webAppName ?? "web");

    mergeInto(addonDir, installTargetDir, {
      projectName: options.projectName,
      scope: options.scope,
    });
    return;
  }

  if (options.frontendDeploy === "docker") {
    const dockerDir = join(targetDir, webAppName ?? "web");
    mkdirSync(dockerDir, { recursive: true });
    writeFileSync(
      join(dockerDir, "Dockerfile"),
      renderHandlebars(join(TEMPLATES_DIR, "addons", "docker", "web", "Dockerfile"), {
        projectName: options.projectName,
        scope: options.scope,
        webPackageName: `${options.scope}/${webAppName ?? "web"}`,
      }),
    );
    return;
  }

  const addonKey = `frontend-${options.frontendDeploy}`;
  const addonDir = join(TEMPLATES_DIR, "addons", addonKey);
  mergeInto(addonDir, appTargetDir, { projectName: options.projectName, scope: options.scope });
}
