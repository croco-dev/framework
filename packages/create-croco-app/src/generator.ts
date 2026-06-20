import { execSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { validateResolvedGoalOptions, writeGoalManifest } from "./goals.js";
import { mergeInto } from "./helpers/fs.js";
import { rewriteExternalCrocoWorkspaceRanges } from "./helpers/manifest-normalizer.js";
import {
  installAgentRules,
  installDocker,
  installFrontendDeploy,
  installGraphqlNextjs,
  installGraphqlStandalone,
  installLambda,
  installMongodb,
  installRedis,
  installSharedUi,
  installTrpcNextjs,
  installTrpcStandalone,
  installWebGraphql,
  installWebTrpc,
} from "./installers/index.js";
import { DirectoryNotEmptyProblem } from "./libs/problems/DirectoryNotEmptyProblem.js";
import { TEMPLATES_DIR } from "./template-path.js";
import type { GeneratorOptions } from "./types.js";

export async function generate(targetDir: string, options: GeneratorOptions): Promise<void> {
  validateResolvedGoalOptions(options);

  const vars = { projectName: options.projectName, scope: options.scope };
  const isVikeFullstackPreset = options.preset === "ddd-vike-fullstack";

  // Step 1: targetDir 정규화 및 생성 (non-empty 체크)
  const resolvedTarget = resolve(targetDir);
  if (existsSync(resolvedTarget) && readdirSync(resolvedTarget).length > 0) {
    throw new DirectoryNotEmptyProblem(resolvedTarget);
  }
  mkdirSync(resolvedTarget, { recursive: true });

  // Step 2: root workspace baseline + 프리셋 분기
  mergeInto(join(TEMPLATES_DIR, "blank"), resolvedTarget, vars);

  if (options.preset === "saas" || options.preset === "ai-saas") {
    mergeInto(join(TEMPLATES_DIR, "saas"), resolvedTarget, vars);
    if (options.preset === "ai-saas") {
      mergeInto(join(TEMPLATES_DIR, "ai-saas"), resolvedTarget, vars);
    }
    if (options.agentRules) {
      installAgentRules(resolvedTarget, vars);
    }
    await finalize(resolvedTarget, options);
    return;
  }

  if (options.preset === "production-app" || options.preset === "admin-console") {
    mergeInto(join(TEMPLATES_DIR, "spa-be-split"), resolvedTarget, vars);
    if (options.preset === "admin-console") {
      mergeInto(join(TEMPLATES_DIR, "admin-console"), resolvedTarget, vars);
    }
    if (options.agentRules) {
      installAgentRules(resolvedTarget, vars);
    }
    await finalize(resolvedTarget, options);
    return;
  }

  if (options.preset !== "blank") {
    mergeInto(join(TEMPLATES_DIR, "base-ddd"), resolvedTarget, vars);
  }

  // 이하 단계들은 blank preset에서는 스킵
  if (options.preset === "blank") {
    await finalize(resolvedTarget, options);
    return;
  }

  // Step 3: API + hosting installer
  if (!isVikeFullstackPreset) {
    if (options.api === "graphql") {
      if (options.apiHosting === "standalone") {
        installGraphqlStandalone(resolvedTarget, vars);
      } else {
        installGraphqlNextjs(resolvedTarget, vars);
      }
    } else if (options.api === "trpc") {
      if (options.apiHosting === "standalone") {
        installTrpcStandalone(resolvedTarget, vars);
      } else {
        installTrpcNextjs(resolvedTarget, vars);
      }
    }
  }

  // Step 4: shared/ui (standalone fullstack or nextjs hosting에서 웹앱 있을 때)
  const hasWebApps = options.webApps.length > 0;
  if (
    !isVikeFullstackPreset &&
    hasWebApps &&
    (options.preset === "ddd-fullstack" || options.apiHosting === "nextjs")
  ) {
    installSharedUi(resolvedTarget, vars);
  }

  // Step 5: web addon (standalone hosting + web apps)
  const frontendDeployOwnsWebApp =
    options.frontendDeploy === "cloudflare-meta-vite" || options.frontendDeploy === "vite-spa";
  if (
    !isVikeFullstackPreset &&
    options.apiHosting === "standalone" &&
    hasWebApps &&
    !frontendDeployOwnsWebApp
  ) {
    for (const webAppName of options.webApps) {
      if (options.api === "graphql") {
        installWebGraphql(resolvedTarget, webAppName, vars);
      } else if (options.api === "trpc") {
        installWebTrpc(resolvedTarget, webAppName, vars);
      }
    }
  }

  // Step 6: backend deploy
  if (!isVikeFullstackPreset) {
    if (options.backendDeploy === "docker") {
      installDocker(resolvedTarget, {
        ...vars,
        api: options.api,
        frontendDeploy: options.frontendDeploy,
        webApps: options.webApps,
      });
    } else if (options.backendDeploy === "lambda") {
      installLambda(resolvedTarget, { ...vars, api: options.api });
    }
  }

  // Step 7: frontend deploy
  if (options.frontendDeploy === "cloudflare-meta-vite" && isVikeFullstackPreset) {
    installFrontendDeploy(resolvedTarget, undefined, {
      ...vars,
      preset: options.preset,
      frontendDeploy: options.frontendDeploy,
    });
  } else if (options.frontendDeploy && hasWebApps) {
    for (const webAppName of options.webApps) {
      installFrontendDeploy(resolvedTarget, webAppName, {
        ...vars,
        preset: options.preset,
        frontendDeploy: options.frontendDeploy,
      });
    }
  }

  // Step 8: DB addons
  if (options.db.includes("mongodb")) {
    installMongodb(resolvedTarget, vars);
  }
  if (options.db.includes("redis")) {
    installRedis(resolvedTarget, vars);
  }

  // Step 9: agent-rules
  if (options.agentRules) {
    installAgentRules(resolvedTarget, vars);
  }

  await finalize(resolvedTarget, options);
}

async function finalize(targetDir: string, options: GeneratorOptions): Promise<void> {
  rewriteExternalCrocoWorkspaceRanges(targetDir);
  writeGoalManifest(targetDir, options);

  // Step 10: .env.example → .env 복사
  const envExample = join(targetDir, ".env.example");
  const envFile = join(targetDir, ".env");
  if (existsSync(envExample) && !existsSync(envFile)) {
    copyFileSync(envExample, envFile);
  }

  // Step 11: git init
  if (options.initGit) {
    execSync("git init", { cwd: targetDir, stdio: "ignore" });
  }

  // Step 12: pnpm install
  if (options.installDeps) {
    installPnpmDependencies(targetDir);
  }
}

function installPnpmDependencies(targetDir: string): void {
  try {
    execSync("pnpm --version", { stdio: "ignore" });
  } catch {
    throw new Error(
      "create-croco-app installs dependencies with pnpm. Install pnpm or rerun with --no-install.",
    );
  }

  execSync("pnpm install", { cwd: targetDir, stdio: "inherit" });
}
