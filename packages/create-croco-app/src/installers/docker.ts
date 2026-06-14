import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { renderHandlebars } from "../helpers/fs.js";
import { TEMPLATES_DIR } from "../template-path.js";
import type { GeneratorOptions } from "../types.js";

function copyDockerTemplate(src: string, dest: string, context: Record<string, unknown>): void {
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, renderHandlebars(src, context));
}

function copyDockerFile(src: string, dest: string): void {
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(src, dest);
}

export function installDocker(
  targetDir: string,
  options: Pick<GeneratorOptions, "projectName" | "scope" | "api" | "frontendDeploy" | "webApps">,
): void {
  const addonDir = join(TEMPLATES_DIR, "addons/docker");
  const apiAppName = options.api === "graphql" ? "graphql-api" : "api";
  const context = {
    projectName: options.projectName,
    scope: options.scope,
    apiDockerfilePath: `apps/${apiAppName}/Dockerfile`,
    apiDistPath: `apps/${apiAppName}/dist`,
    apiPackageName: `${options.scope}/${apiAppName}`,
    apiPort: options.api === "graphql" ? 4000 : 3001,
    apiRuntimePath: `apps/${apiAppName}/dist/index.js`,
    webPackageName: `${options.scope}/web`,
  };

  copyDockerFile(join(addonDir, ".dockerignore"), join(targetDir, ".dockerignore"));
  copyDockerFile(
    join(addonDir, "docker-compose.dev.yml"),
    join(targetDir, "docker-compose.dev.yml"),
  );
  copyDockerTemplate(
    join(addonDir, "docker-compose.yml.hbs"),
    join(targetDir, "docker-compose.yml"),
    context,
  );
  copyDockerTemplate(
    join(addonDir, "apps", apiAppName, "Dockerfile"),
    join(targetDir, "apps", apiAppName, "Dockerfile"),
    context,
  );

  if (!options.webApps.includes("web")) {
    return;
  }

  const webDockerfileName =
    options.frontendDeploy === "vite-spa" ? "Dockerfile.vite-spa" : "Dockerfile";
  copyDockerTemplate(
    join(addonDir, "web", webDockerfileName),
    join(targetDir, "web", webDockerfileName),
    context,
  );
}
