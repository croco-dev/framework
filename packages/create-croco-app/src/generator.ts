import { execSync } from "node:child_process";
import {
  DEFAULT_TENANT_MODEL,
  createTenantModelManifest,
  createTenantModelManifestSchema,
  renderTenantModelPlaybook,
} from "@croco/tenant-core/tenant-model";
import {
  createRuntimeCapabilityManifest,
  stringifyRuntimeCapabilityManifest,
} from "@croco/framework-context";
import type { KnownRuntimePlatform } from "@croco/framework-context";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { writeGoalManifest } from "./goals.js";
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
  installUiProfile,
  installWebGraphql,
  installWebTrpc,
} from "./installers/index.js";
import { DirectoryNotEmptyProblem } from "./libs/problems/DirectoryNotEmptyProblem.js";
import { assertSupportedNodeVersion, writeGeneratedNodeRuntimeContract } from "./node-runtime.js";
import { validateResolvedOptions } from "./options.js";
import {
  DEFAULT_SAAS_PROVIDER_PROFILE,
  assertSaasProviderTenantModelCompatibility,
  assertSaasProviderProfileCapabilities,
  createSaasProviderProfileManifest,
  getSaasProviderProfileDefinition,
  getSaasProviderPackageDependencyRange,
  renderSaasDeployNotes,
  renderSaasEnvExample,
  renderSaasSecretsChecklist,
} from "./saas-provider-profiles.js";
import { TEMPLATES_DIR } from "./template-path.js";
import type { GeneratorOptions } from "./types.js";
import type { SaasProviderProfileManifest } from "./saas-provider-profiles.js";

export async function generate(targetDir: string, options: GeneratorOptions): Promise<void> {
  assertSupportedNodeVersion();
  validateResolvedOptions(options);

  const vars = { projectName: options.projectName, scope: options.scope };
  const isLegacyVikeFullstackPreset = options.preset === "ddd-vike-fullstack";

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
    writeSaasProviderProfileArtifacts(resolvedTarget, options);
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
  if (!isLegacyVikeFullstackPreset) {
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
    !isLegacyVikeFullstackPreset &&
    hasWebApps &&
    (options.preset === "ddd-fullstack" || options.apiHosting === "nextjs")
  ) {
    if (options.ui === undefined) {
      installSharedUi(resolvedTarget, vars);
    }
  }

  // Step 5: web addon (standalone hosting + web apps)
  const frontendDeployOwnsWebApp =
    options.frontendDeploy === "cloudflare-meta-vite" || options.frontendDeploy === "vite-spa";
  if (
    !isLegacyVikeFullstackPreset &&
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
  if (!isLegacyVikeFullstackPreset) {
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
  if (options.frontendDeploy === "cloudflare-meta-vite" && isLegacyVikeFullstackPreset) {
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
      installUiProfile(resolvedTarget, webAppName, {
        ...vars,
        frontendDeploy: options.frontendDeploy,
        ...(options.ui === undefined ? {} : { ui: options.ui }),
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

function writeSaasProviderProfileArtifacts(targetDir: string, options: GeneratorOptions): void {
  const profile = getSaasProviderProfileDefinition(
    options.saasProviderProfile ?? DEFAULT_SAAS_PROVIDER_PROFILE,
  );
  const tenantModel = options.tenantModel ?? DEFAULT_TENANT_MODEL;
  assertSaasProviderProfileCapabilities(profile);
  assertSaasProviderTenantModelCompatibility(profile, tenantModel);

  const manifest = createSaasProviderProfileManifest(profile, tenantModel);
  const tenantModelManifest = createTenantModelManifest(tenantModel);
  const tenantModelSchema = createTenantModelManifestSchema();
  const tenantModelPlaybook = renderTenantModelPlaybook(tenantModelManifest);
  const providerProfileDocs = renderSaasDeployNotes(manifest);
  const providerEnvExample = renderSaasEnvExample(manifest);
  const providerSecretsChecklist = renderSaasSecretsChecklist(manifest);
  const docsDir = join(targetDir, "docs");
  const apiServerSrcDir = join(targetDir, "apps", "api-server", "src");

  mkdirSync(docsDir, { recursive: true });
  writeFileSync(
    join(targetDir, "croco-saas-profile.manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  writeFileSync(
    join(targetDir, "croco-tenant-model.manifest.json"),
    `${JSON.stringify(tenantModelManifest, null, 2)}\n`,
  );
  writeFileSync(
    join(targetDir, "croco-tenant-model.schema.json"),
    `${JSON.stringify(tenantModelSchema, null, 2)}\n`,
  );
  writeFileSync(
    join(targetDir, "croco-runtime-policy.manifest.json"),
    `${JSON.stringify(createRuntimePolicyManifest(manifest), null, 2)}\n`,
  );
  writeFileSync(
    join(targetDir, "croco.arch.json"),
    `${JSON.stringify(createArchitecturePolicyManifest(options), null, 2)}\n`,
  );
  writeFileSync(join(targetDir, ".env.example"), providerEnvExample);
  writeFileSync(join(docsDir, "provider-profile.md"), providerProfileDocs);
  writeFileSync(join(docsDir, "tenant-model-playbook.md"), tenantModelPlaybook);
  writeFileSync(join(docsDir, "secrets-checklist.md"), providerSecretsChecklist);
  writeFileSync(
    join(apiServerSrcDir, "generatedSaasProviderProfile.ts"),
    [
      `export const generatedSaasProviderProfileManifest = ${JSON.stringify(manifest, null, 2)} as const;`,
      `export const generatedSaasProviderProfileDocs = ${JSON.stringify(providerProfileDocs)} as const;`,
      `export const generatedSaasProviderProfileEnvExample = ${JSON.stringify(providerEnvExample)} as const;`,
      `export const generatedSaasProviderSecretsChecklist = ${JSON.stringify(providerSecretsChecklist)} as const;`,
      "",
    ].join("\n"),
  );
  writeFileSync(
    join(apiServerSrcDir, "generatedTenantModel.ts"),
    [
      `export const generatedTenantModelManifest = ${JSON.stringify(tenantModelManifest, null, 2)} as const;`,
      `export const generatedTenantModelManifestSchema = ${JSON.stringify(tenantModelSchema, null, 2)} as const;`,
      `export const generatedTenantModelPlaybook = ${JSON.stringify(tenantModelPlaybook)} as const;`,
      "",
    ].join("\n"),
  );
  writeSaasProviderPackageDependencies(targetDir, manifest);
}

function createRuntimePolicyManifest(
  manifest: SaasProviderProfileManifest,
): Record<string, unknown> {
  return {
    schemaVersion: "croco.runtime-policy/v1",
    runtime: {
      platform: manifest.profile.runtimeTarget,
      source: {
        file: "croco-saas-profile.manifest.json",
        symbol: manifest.profile.name,
      },
    },
    table: {
      plans: [],
    },
  };
}

function createArchitecturePolicyManifest(options: GeneratorOptions): Record<string, unknown> {
  return {
    schemaVersion: "croco.architecture-policy/v1",
    policyName: `${options.projectName}-generated-app`,
    packageRoots: ["apps", "libs"],
    include: [
      "apps/*/src/**/*.ts",
      "apps/*/src/**/*.tsx",
      "libs/shared/*/src/**/*.ts",
      "libs/shared/*/src/**/*.tsx",
    ],
    ignore: [
      "apps/*/src/**/__tests__/**",
      "apps/*/src/**/tests/**",
      "apps/*/src/**/*.spec.ts",
      "apps/*/src/**/*.spec.tsx",
      "apps/*/src/**/*.test.ts",
      "apps/*/src/**/*.test.tsx",
      "libs/shared/*/src/**/__tests__/**",
      "libs/shared/*/src/**/tests/**",
      "libs/shared/*/src/**/*.spec.ts",
      "libs/shared/*/src/**/*.spec.tsx",
      "libs/shared/*/src/**/*.test.ts",
      "libs/shared/*/src/**/*.test.tsx",
    ],
    packageGroups: {
      app: {
        description: "Generated application entrypoints.",
        paths: ["apps/*"],
      },
      "provider-contract": {
        description: "Generated RPC provider contract package.",
        packages: [`${options.scope}/provider-rpc`],
      },
      provider: {
        description: "Generated provider adapter packages.",
        paths: ["libs/shared/provider-*"],
      },
      framework: {
        description: "Croco framework and domain contracts.",
        packages: [
          "@croco/*-core",
          "@croco/diagnostics-core",
          "@croco/framework-*",
          "@croco/llm-metering",
          "@croco/problems-core",
          "@croco/telemetry-api",
          "@croco/tx-core",
        ],
      },
      protocols: {
        description: "Croco protocol and generated contract tooling.",
        packages: ["@croco/openapi-spec", "@croco/protocols-*", "@croco/rpc-codegen"],
      },
      transports: {
        description: "Croco runtime transports used by the generated app.",
        packages: ["@croco/transports-*"],
      },
      integrations: {
        description: "Concrete provider/runtime integrations selected by the profile.",
        packages: [
          "@croco/*-drizzle",
          "@croco/*-qstash",
          "@croco/*-upstash",
          "@croco/auth-better-auth",
          "@croco/auth-clerk",
          "@croco/billing-polar",
          "@croco/storage-*",
          "@croco/telemetry-sdk-node",
          "@croco/triggers-qstash",
          "@croco/tx-drizzle",
        ],
      },
      tooling: {
        description: "Build-time generated app tooling.",
        packages: ["@croco/cli"],
      },
    },
    rules: {
      allowedGroupImports: [
        {
          id: "generated-app-layer-edges",
          description:
            "Generated app packages can depend on Croco contracts, selected adapters, and the generated provider-rpc contract, but provider packages must not import app entrypoints.",
          fromGroups: ["app"],
          allowGroups: [
            "framework",
            "protocols",
            "transports",
            "integrations",
            "provider-contract",
            "tooling",
          ],
          allowPackages: [`${options.scope}/provider-rpc`],
          allowExternal: true,
          message:
            "Generated app entrypoints can import Croco contracts, selected adapters, and provider-rpc only.",
          recovery:
            "Move shared provider code into libs/shared and expose app-facing types through the provider-rpc package.",
        },
        {
          id: "generated-provider-layer-edges",
          fromGroups: ["provider", "provider-contract"],
          allowGroups: ["framework", "protocols"],
          allowExternal: true,
          message: "Generated provider packages cannot import app entrypoints.",
          recovery:
            "Keep provider packages reusable by depending only on Croco contracts, protocols, and external SDKs.",
        },
      ],
      publicEntrypoints: {
        id: "generated-app-public-entrypoints",
        description:
          "Generated app packages import declared package entrypoints instead of source internals.",
        includePackages: ["@croco/*", `${options.scope}/*`],
        ignoreImports: [
          {
            paths: [
              "apps/*/src/**/__tests__/**",
              "apps/*/src/**/tests/**",
              "apps/*/src/**/*.spec.ts",
              "apps/*/src/**/*.spec.tsx",
              "apps/*/src/**/*.test.ts",
              "apps/*/src/**/*.test.tsx",
              "libs/shared/*/src/**/__tests__/**",
              "libs/shared/*/src/**/tests/**",
              "libs/shared/*/src/**/*.spec.ts",
              "libs/shared/*/src/**/*.spec.tsx",
              "libs/shared/*/src/**/*.test.ts",
              "libs/shared/*/src/**/*.test.tsx",
            ],
            specifiers: ["@croco/*/src/**", `${options.scope}/*/src/**`],
          },
        ],
        message: "Generated app code must import declared public package entrypoints.",
        recovery:
          "Export the required type or runtime surface from the package entrypoint before consuming it.",
      },
    },
  };
}

function writeSaasProviderPackageDependencies(
  targetDir: string,
  manifest: SaasProviderProfileManifest,
): void {
  const packageJsonPath = join(targetDir, "apps", "api-server", "package.json");
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
    dependencies?: Record<string, string>;
  };
  const dependencies = packageJson.dependencies ?? {};

  for (const packageName of [...manifest.packages, ...manifest.tenantModel.requiredPackages]) {
    dependencies[packageName] ??= getSaasProviderPackageDependencyRange(packageName);
  }

  packageJson.dependencies = dependencies;
  writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
}

async function finalize(targetDir: string, options: GeneratorOptions): Promise<void> {
  rewriteExternalCrocoWorkspaceRanges(targetDir);
  writeGeneratedNodeRuntimeContract(targetDir);
  writeGoalManifest(targetDir, options);
  writeRuntimeCapabilityManifest(targetDir, options);

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

function writeRuntimeCapabilityManifest(targetDir: string, options: GeneratorOptions): void {
  const platform = resolveRuntimeCapabilityPlatform(options);
  const manifest = createRuntimeCapabilityManifest(platform);

  writeFileSync(
    join(targetDir, "croco-runtime-capability.manifest.json"),
    stringifyRuntimeCapabilityManifest(manifest),
  );
}

function resolveRuntimeCapabilityPlatform(options: GeneratorOptions): KnownRuntimePlatform {
  if (options.saasProviderProfile) {
    return getSaasProviderProfileDefinition(options.saasProviderProfile).runtimeTarget;
  }

  if (options.backendDeploy === "lambda") {
    return "lambda";
  }

  if (options.frontendDeploy === "cloudflare-meta-vite") {
    return "cloudflare-workers";
  }

  return "node";
}

function installPnpmDependencies(targetDir: string): void {
  try {
    execSync("pnpm --version", { stdio: "ignore" });
  } catch {
    throw new Error(
      "create-croco-app installs dependencies with pnpm. Install pnpm or rerun with --no-install.",
    );
  }

  execSync("pnpm install --no-frozen-lockfile", { cwd: targetDir, stdio: "inherit" });
  execSync("pnpm install --lockfile-only --frozen-lockfile", {
    cwd: targetDir,
    stdio: "inherit",
  });
}
