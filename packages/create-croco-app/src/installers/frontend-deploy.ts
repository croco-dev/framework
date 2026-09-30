import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { mergeInto, renderHandlebars } from "../helpers/fs.js";
import { TEMPLATES_DIR } from "../template-path.js";
import type { GeneratorFrontendDeploy } from "../types.js";

type FrontendDeployInstallerOptions = {
  readonly projectName: string;
  readonly scope: string;
  readonly preset: "ddd-fullstack" | "ddd-vike-fullstack";
  readonly frontendDeploy: GeneratorFrontendDeploy;
};

export function installFrontendDeploy(
  targetDir: string,
  webAppName: string | undefined,
  options: FrontendDeployInstallerOptions,
): void {
  const resolvedWebAppName = webAppName ?? "web";
  const appTargetDir = join(targetDir, "apps", resolvedWebAppName);
  const vars = {
    projectName: options.projectName,
    scope: options.scope,
    webAppName: resolvedWebAppName,
  };

  if (options.frontendDeploy === "vite-spa") {
    const addonDir = join(TEMPLATES_DIR, "addons", "frontend-vite-spa");
    mergeInto(addonDir, appTargetDir, vars);
    return;
  }

  if (options.frontendDeploy === "cloudflare-meta-vite") {
    const addonDir =
      options.preset === "ddd-vike-fullstack"
        ? join(TEMPLATES_DIR, "addons", "web-meta-vite-fullstack")
        : join(TEMPLATES_DIR, "addons", "web-meta-vite");
    const installTargetDir = options.preset === "ddd-vike-fullstack" ? targetDir : appTargetDir;

    mergeInto(addonDir, installTargetDir, vars);
    return;
  }

  if (options.frontendDeploy === "docker") {
    const dockerDir = join(targetDir, resolvedWebAppName);
    mkdirSync(dockerDir, { recursive: true });
    writeFileSync(
      join(dockerDir, "Dockerfile"),
      renderHandlebars(join(TEMPLATES_DIR, "addons", "docker", "web", "Dockerfile"), {
        ...vars,
        webPackageName: `${options.scope}/${resolvedWebAppName}`,
      }),
    );
    return;
  }

  const addonKey = `frontend-${options.frontendDeploy}`;
  const addonDir = join(TEMPLATES_DIR, "addons", addonKey);
  mergeInto(addonDir, appTargetDir, vars);
}
