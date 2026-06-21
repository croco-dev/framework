import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createWorkspacePackageIndex,
  resolveLocalCrocoPackagesForGeneratedProject,
  rewriteExternalCrocoRanges,
  type DependencyField,
  type ExternalCrocoRangeException,
  type PackageJson,
  type WorkspacePackage,
} from "./create-croco-app-generated-smoke-support.mts";
import { SUPPORTED_CREATE_CROCO_APP_CHOICES } from "../packages/create-croco-app/src/supported-options.ts";

type SmokeValidation = {
  readonly label: string;
  readonly packagePath?: readonly string[];
  readonly args?: readonly string[];
  readonly paths?: readonly string[];
  readonly json?: {
    readonly path: string;
    readonly matches: Record<string, unknown>;
  };
  readonly env?: Readonly<Record<string, string>>;
  readonly expectFailure?: {
    readonly outputIncludes: readonly string[];
  };
};

type SmokeCase = {
  readonly name: string;
  readonly args: readonly string[];
  readonly validations: readonly SmokeValidation[];
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, "..");
const cliPath = join(rootDir, "packages", "create-croco-app", "dist", "index.js");
const turboPath = join(rootDir, "node_modules", "turbo", "bin", "turbo");
const smokeRoot = mkdtempSync(join(tmpdir(), "croco-generated-app-smoke-"));
const commandTimeoutMs = 600_000;
const loadViteConfigScript = [
  'import { join } from "node:path";',
  'import { loadConfigFromFile } from "vite";',
  'const result = await loadConfigFromFile({ command: "build", mode: "production" }, join(process.cwd(), "vite.config.ts"));',
  'if (!result) throw new Error("vite.config.ts did not load");',
].join(" ");
const generatedSmokeExternalCrocoRangeExceptions = {} satisfies Record<
  string,
  ExternalCrocoRangeException
>;

const smokeCases: readonly SmokeCase[] = [
  {
    name: "blank-basic",
    args: ["--preset", "blank", "--scope", "@smoke", "--no-install", "--no-git"],
    validations: [{ label: "typecheck", args: ["typecheck"] }],
  },
  {
    name: "goal-saas-api",
    args: ["--goal", "saas-api", "--scope", "@smoke", "--no-install", "--no-git"],
    validations: [
      {
        label: "manifest",
        json: {
          path: "croco.app.json",
          matches: {
            schemaVersion: 1,
            goal: "saas-api",
            preset: "saas",
            runtimeTarget: "node",
            providers: [
              "in-memory-tenant",
              "in-memory-auth",
              "in-memory-billing",
              "in-memory-metering",
              "in-memory-events",
            ],
          },
        },
      },
      { label: "typecheck", args: ["typecheck"] },
      { label: "build", args: ["build"] },
      { label: "test", args: ["test"] },
    ],
  },
  {
    name: "graphql-lambda-api",
    args: [
      "--preset",
      "ddd-api",
      "--scope",
      "@smoke",
      "--api",
      "graphql",
      "--api-hosting",
      "standalone",
      "--backend-deploy",
      "lambda",
      "--db",
      "postgres,mongodb,redis",
      "--no-install",
      "--no-git",
    ],
    validations: [
      { label: "typecheck", args: ["typecheck"] },
      { label: "build", args: ["build"] },
    ],
  },
  {
    name: "trpc-nextjs-vercel-fullstack",
    args: [
      "--preset",
      "ddd-fullstack",
      "--scope",
      "@smoke",
      "--api",
      "trpc",
      "--api-hosting",
      "nextjs",
      "--web-apps",
      "web",
      "--frontend-deploy",
      "vercel",
      "--no-install",
      "--no-git",
    ],
    validations: [{ label: "build", args: ["build"] }],
  },
  {
    name: "graphql-nextjs-opennext",
    args: [
      "--preset",
      "ddd-fullstack",
      "--scope",
      "@smoke",
      "--api",
      "graphql",
      "--api-hosting",
      "nextjs",
      "--web-apps",
      "web",
      "--frontend-deploy",
      "opennext",
      "--no-install",
      "--no-git",
    ],
    validations: [
      {
        label: "OpenNext deployment files",
        packagePath: ["apps", "web"],
        paths: ["open-next.config.ts", "wrangler.toml"],
      },
    ],
  },
  {
    name: "trpc-nextjs-docker-frontend",
    args: [
      "--preset",
      "ddd-fullstack",
      "--scope",
      "@smoke",
      "--api",
      "trpc",
      "--api-hosting",
      "nextjs",
      "--web-apps",
      "web",
      "--frontend-deploy",
      "docker",
      "--no-install",
      "--no-git",
    ],
    validations: [{ label: "frontend Dockerfile", paths: ["web/Dockerfile"] }],
  },
  {
    name: "graphql-vite-spa-docker",
    args: [
      "--preset",
      "ddd-fullstack",
      "--scope",
      "@smoke",
      "--api",
      "graphql",
      "--api-hosting",
      "standalone",
      "--web-apps",
      "web",
      "--backend-deploy",
      "docker",
      "--frontend-deploy",
      "vite-spa",
      "--no-install",
      "--no-git",
    ],
    validations: [
      {
        label: "apps/web vite config load",
        packagePath: ["apps", "web"],
        args: ["exec", "node", "--input-type=module", "--eval", loadViteConfigScript],
      },
      { label: "vite SPA Dockerfile", paths: ["web/Dockerfile.vite-spa"] },
    ],
  },
  {
    name: "meta-vite-web",
    args: [
      "--preset",
      "ddd-fullstack",
      "--scope",
      "@smoke",
      "--api",
      "graphql",
      "--api-hosting",
      "standalone",
      "--web-apps",
      "web",
      "--frontend-deploy",
      "cloudflare-meta-vite",
      "--no-install",
      "--no-git",
    ],
    validations: [
      {
        label: "apps/web vite config load",
        packagePath: ["apps", "web"],
        args: ["exec", "node", "--input-type=module", "--eval", loadViteConfigScript],
      },
      {
        label: "apps/web presentation smoke",
        packagePath: ["apps", "web"],
        args: ["presentation:smoke"],
      },
    ],
  },
  {
    name: "meta-vite-fullstack-workers",
    args: [
      "--preset",
      "ddd-vike-fullstack",
      "--scope",
      "@smoke",
      "--api-hosting",
      "standalone",
      "--frontend-deploy",
      "cloudflare-meta-vite",
      "--no-install",
      "--no-git",
    ],
    validations: [
      {
        label: "ssr-worker vite config load",
        packagePath: ["ssr-worker"],
        args: ["exec", "node", "--input-type=module", "--eval", loadViteConfigScript],
      },
      {
        label: "ssr-worker presentation smoke",
        packagePath: ["ssr-worker"],
        args: ["presentation:smoke"],
      },
    ],
  },
  {
    name: "production-app-starter",
    args: ["--preset", "production-app", "--scope", "@smoke", "--no-install", "--no-git"],
    validations: [
      { label: "dev smoke", args: ["dev:smoke"] },
      { label: "lint", args: ["lint"] },
      { label: "test", args: ["test"] },
      { label: "typecheck", args: ["typecheck"] },
      { label: "build", args: ["build"] },
      {
        label: "Contract snapshot",
        args: ["contract:snapshot"],
        paths: ["contract-graph.snapshot.json"],
      },
      {
        label: "Contract coverage",
        args: ["contract:coverage"],
        paths: ["contract-graph.coverage.json"],
      },
      { label: "Contract diff", args: ["contract:diff"] },
      { label: "OpenAPI contract", args: ["contract:openapi"] },
      {
        label: "RPC client",
        args: ["contract:client"],
        paths: ["libs/shared/provider-rpc/src/user.ts"],
      },
    ],
  },
  {
    name: "admin-console-starter",
    args: ["--preset", "admin-console", "--scope", "@smoke", "--no-install", "--no-git"],
    validations: [
      { label: "admin smoke", args: ["admin:smoke"] },
      { label: "lint", args: ["lint"] },
      { label: "test", args: ["test"] },
      { label: "typecheck", args: ["typecheck"] },
      { label: "build", args: ["build"] },
      {
        label: "Contract snapshot",
        args: ["contract:snapshot"],
        paths: ["contract-graph.snapshot.json"],
      },
      {
        label: "Contract verify",
        args: ["contract:verify"],
        paths: ["contract-graph.coverage.json"],
      },
      {
        label: "Admin RPC client",
        args: ["contract:client"],
        paths: ["libs/shared/provider-rpc/src/admin.ts"],
      },
    ],
  },
  {
    name: "saas-golden-path",
    args: [
      "--preset",
      "saas",
      "--scope",
      "@smoke",
      "--saas-profile",
      "saas-node-postgres",
      "--no-install",
      "--no-git",
    ],
    validations: [
      {
        label: "provider profile manifest",
        args: ["profile:check"],
        paths: [
          "croco-saas-profile.manifest.json",
          ".env.example",
          "docs/provider-profile.md",
          "docs/secrets-checklist.md",
          "apps/api-server/src/generatedSaasProviderProfile.ts",
        ],
      },
      {
        label: "real-provider missing env diagnostic",
        args: ["profile:smoke:real"],
        env: {
          SAAS_PROVIDER_PROFILE: "saas-node-postgres",
          DATABASE_URL: "",
          BETTER_AUTH_SECRET: "",
          BETTER_AUTH_URL: "",
          POLAR_ACCESS_TOKEN: "",
          POLAR_WEBHOOK_SECRET: "",
          POLAR_PRODUCT_ID_TEAM: "",
          UPSTASH_QSTASH_TOKEN: "",
          UPSTASH_QSTASH_CURRENT_SIGNING_KEY: "",
          UPSTASH_QSTASH_NEXT_SIGNING_KEY: "",
          CLOUDINARY_URL: "",
        },
        expectFailure: {
          outputIncludes: [
            "CROCO_SAAS_PROFILE_ENV_MISSING",
            "DATABASE_URL",
            "POLAR_ACCESS_TOKEN",
            "CLOUDINARY_URL",
          ],
        },
      },
      {
        label: "usage dashboard generator",
        args: ["exec", "croco", "generate", "usage-dashboard", "--no-page"],
        paths: [
          "apps/api-server/src/controllers/UsageDashboardController.ts",
          "apps/api-server/src/usage-dashboard/UsageDashboardService.ts",
        ],
      },
      { label: "typecheck", args: ["typecheck"] },
      { label: "build", args: ["build"] },
      { label: "test", args: ["test"] },
      {
        label: "Contract snapshot",
        args: ["contract:snapshot"],
        paths: ["contract-graph.snapshot.json"],
      },
      {
        label: "Contract verify",
        args: ["contract:verify"],
        paths: ["contract-graph.coverage.json"],
      },
      { label: "demo seed", args: ["demo:seed"] },
      { label: "demo flow", args: ["demo:smoke"] },
    ],
  },
  {
    name: "saas-cloudflare-profile",
    args: [
      "--preset",
      "saas",
      "--scope",
      "@smoke",
      "--saas-profile",
      "saas-cloudflare",
      "--no-install",
      "--no-git",
    ],
    validations: [
      {
        label: "provider profile manifest",
        args: ["profile:check"],
        paths: [
          "croco-saas-profile.manifest.json",
          ".env.example",
          "docs/provider-profile.md",
          "docs/secrets-checklist.md",
          "apps/api-server/src/generatedSaasProviderProfile.ts",
        ],
      },
      { label: "typecheck", args: ["typecheck"] },
      { label: "build", args: ["build"] },
      { label: "test", args: ["test"] },
      { label: "demo flow", args: ["demo:smoke"] },
    ],
  },
  {
    name: "saas-lambda-profile",
    args: [
      "--preset",
      "saas",
      "--scope",
      "@smoke",
      "--saas-profile",
      "saas-lambda",
      "--no-install",
      "--no-git",
    ],
    validations: [
      {
        label: "provider profile manifest",
        args: ["profile:check"],
        paths: [
          "croco-saas-profile.manifest.json",
          ".env.example",
          "docs/provider-profile.md",
          "docs/secrets-checklist.md",
          "apps/api-server/src/generatedSaasProviderProfile.ts",
        ],
      },
      { label: "typecheck", args: ["typecheck"] },
      { label: "build", args: ["build"] },
      { label: "test", args: ["test"] },
      { label: "demo flow", args: ["demo:smoke"] },
    ],
  },
  {
    name: "ai-saas-golden-path",
    args: ["--preset", "ai-saas", "--scope", "@smoke", "--no-install", "--no-git"],
    validations: [
      { label: "typecheck", args: ["typecheck"] },
      { label: "build", args: ["build"] },
      { label: "test", args: ["test"] },
      {
        label: "Contract snapshot",
        args: ["contract:snapshot"],
        paths: ["contract-graph.snapshot.json"],
      },
      {
        label: "Contract verify",
        args: ["contract:verify"],
        paths: ["contract-graph.coverage.json"],
      },
      { label: "AI demo flow", args: ["ai:smoke"] },
      { label: "full demo flow", args: ["demo:smoke"] },
    ],
  },
];

try {
  const selectedSmokeCases = selectSmokeCases(smokeCases);
  const isFilteredRun = selectedSmokeCases.length !== smokeCases.length;

  if (isFilteredRun) {
    console.log(
      `create-croco-app-generated-smoke: selected cases ${selectedSmokeCases.map(({ name }) => name).join(", ")}`,
    );
  } else {
    assertSmokeCoverage(smokeCases);
    printSmokeCoverageSummary(smokeCases);
  }

  runGeneratedAppContractGates();

  run(
    process.execPath,
    [
      turboPath,
      "build",
      "--filter=@croco/auth-better-auth...",
      "--filter=@croco/auth-clerk...",
      "--filter=@croco/auth-drizzle...",
      "--filter=@croco/billing-polar...",
      "--filter=@croco/cli...",
      "--filter=@croco/events-core...",
      "--filter=@croco/events-inmemory...",
      "--filter=create-croco-app...",
      "--filter=@croco/framework-context...",
      "--filter=@croco/frontend-cloudflare...",
      "--filter=@croco/frontend-problems...",
      "--filter=@croco/frontend-react...",
      "--filter=@croco/frontend-vite...",
      "--filter=@croco/llm-core...",
      "--filter=@croco/llm-metering...",
      "--filter=@croco/meta-vite...",
      "--filter=@croco/lifecycle-core...",
      "--filter=@croco/metering-drizzle...",
      "--filter=@croco/metering-upstash...",
      "--filter=@croco/openapi-spec...",
      "--filter=@croco/problems-core...",
      "--filter=@croco/preset-cloudflare...",
      "--filter=@croco/preset-lambda...",
      "--filter=@croco/repository-core...",
      "--filter=@croco/retry-core...",
      "--filter=@croco/rpc-codegen...",
      "--filter=@croco/storage-cloudinary...",
      "--filter=@croco/storage-r2...",
      "--filter=@croco/tasks-qstash...",
      "--filter=@croco/telemetry-api...",
      "--filter=@croco/telemetry-sdk-node...",
      "--filter=@croco/transports-http...",
      "--filter=@croco/triggers-qstash...",
      "--filter=@croco/tx-drizzle...",
      "--force",
    ],
    rootDir,
  );
  assertExists(cliPath, "create-croco-app dist CLI is missing after build");

  const workspacePackageIndex = createWorkspacePackageIndex(rootDir);
  const packedWorkspacePackages = new Map<string, string>();
  const builtWorkspacePackageNames = new Set<string>();

  for (const smokeCase of selectedSmokeCases) {
    const projectDir = join(smokeRoot, smokeCase.name);

    run("node", [cliPath, projectDir, ...smokeCase.args], rootDir);
    const generatedSmokeRangeOverrides = getGeneratedSmokeRangeOverrides(
      projectDir,
      join(smokeRoot, "generated-package-packs"),
      workspacePackageIndex,
      packedWorkspacePackages,
      builtWorkspacePackageNames,
    );
    rewriteExternalCrocoRanges(
      projectDir,
      generatedSmokeRangeOverrides,
      generatedSmokeExternalCrocoRangeExceptions,
    );
    writePnpmOverrides(projectDir, generatedSmokeRangeOverrides);
    run("pnpm", ["install"], projectDir);
    const lockfilePath = join(projectDir, "pnpm-lock.yaml");
    assertExists(lockfilePath, `${smokeCase.name} did not create a pnpm lockfile`);
    assertPnpmLockfileUsesLocalTarballOverrides(
      lockfilePath,
      smokeCase.name,
      generatedSmokeRangeOverrides,
    );
    assertExists(
      join(projectDir, "node_modules"),
      `${smokeCase.name} did not install dependencies with pnpm`,
    );

    for (const validation of smokeCase.validations) {
      runValidation(projectDir, smokeCase, validation);
    }
  }

  if (!isFilteredRun) {
    runSpaBeSplitContractSmoke(
      workspacePackageIndex,
      packedWorkspacePackages,
      builtWorkspacePackageNames,
    );
  }

  console.log("create-croco-app-generated-smoke: all generated app smoke cases passed");
} finally {
  rmSync(smokeRoot, { force: true, recursive: true });
}

function runGeneratedAppContractGates(): void {
  runGate("strict contract typecheck", ["strict-contract-typecheck"]);
  runGate("static misuse check", ["static-misuse:check"]);
  runGate("generated template oxlint", ["exec", "oxlint", "packages/create-croco-app/templates"]);
}

function runGate(label: string, args: readonly string[]): void {
  run("pnpm", args, rootDir);
  console.log(`create-croco-app-generated-smoke: ${label} passed`);
}

function selectSmokeCases(cases: readonly SmokeCase[]): readonly SmokeCase[] {
  const requestedCaseNames = new Set(process.argv.slice(2).filter(Boolean));
  const envValue = process.env.CROCO_GENERATED_SMOKE_CASES;

  if (envValue) {
    for (const caseName of envValue.split(",")) {
      const trimmedCaseName = caseName.trim();
      if (trimmedCaseName) {
        requestedCaseNames.add(trimmedCaseName);
      }
    }
  }

  if (requestedCaseNames.size === 0) {
    return cases;
  }

  const selectedCases = cases.filter(({ name }) => requestedCaseNames.has(name));
  const unknownCases = [...requestedCaseNames].filter(
    (caseName) => !cases.some(({ name }) => name === caseName),
  );

  if (unknownCases.length > 0) {
    throw new Error(`Unknown create-croco-app generated smoke case(s): ${unknownCases.join(", ")}`);
  }

  return selectedCases;
}

function assertExists(path: string, message: string): void {
  if (!existsSync(path)) {
    throw new Error(message);
  }
}

function runValidation(
  projectDir: string,
  smokeCase: SmokeCase,
  validation: SmokeValidation,
): void {
  const validationDir = validation.packagePath
    ? join(projectDir, ...validation.packagePath)
    : projectDir;

  if (validation.args) {
    if (validation.expectFailure) {
      runExpectFailure(
        "pnpm",
        ["--dir", validationDir, ...validation.args],
        rootDir,
        validation.expectFailure.outputIncludes,
        validation.env,
      );
    } else {
      run("pnpm", ["--dir", validationDir, ...validation.args], rootDir, validation.env);
    }
  }

  for (const relativePath of validation.paths ?? []) {
    assertExists(
      join(validationDir, relativePath),
      `${smokeCase.name} ${validation.label} did not create ${relativePath}`,
    );
  }

  if (validation.json) {
    assertJsonMatches(
      join(validationDir, validation.json.path),
      validation.json.matches,
      `${smokeCase.name} ${validation.label}`,
    );
  }

  if (!validation.args && !validation.paths && !validation.json) {
    throw new Error(`${smokeCase.name} ${validation.label} has no validation action`);
  }

  console.log(`create-croco-app-generated-smoke: ${smokeCase.name} ${validation.label} passed`);
}

function assertSmokeCoverage(cases: readonly SmokeCase[]): void {
  const coverage = readSmokeCoverage(cases);

  assertCovers("presets", SUPPORTED_CREATE_CROCO_APP_CHOICES.presets, coverage.presets);
  assertCovers("apis", SUPPORTED_CREATE_CROCO_APP_CHOICES.apis, coverage.apis);
  assertCovers("api-hosting", SUPPORTED_CREATE_CROCO_APP_CHOICES.apiHosting, coverage.apiHosting);
  assertCovers(
    "backend-deploy",
    SUPPORTED_CREATE_CROCO_APP_CHOICES.backendDeploys,
    coverage.backendDeploys,
  );
  assertCovers(
    "frontend-deploy",
    SUPPORTED_CREATE_CROCO_APP_CHOICES.frontendDeploys,
    coverage.frontendDeploys,
  );
  assertCovers("db", SUPPORTED_CREATE_CROCO_APP_CHOICES.databases, coverage.databases);
  assertCovers(
    "saas-profile",
    SUPPORTED_CREATE_CROCO_APP_CHOICES.saasProviderProfiles,
    coverage.saasProviderProfiles,
  );
}

function printSmokeCoverageSummary(cases: readonly SmokeCase[]): void {
  const coverage = readSmokeCoverage(cases);

  console.log(
    `create-croco-app-generated-smoke: matrix cases ${cases.map(({ name }) => name).join(", ")}`,
  );
  console.log(
    `create-croco-app-generated-smoke: matrix covers presets=${coverage.presets.join(", ")}; apis=${coverage.apis.join(", ")}; api-hosting=${coverage.apiHosting.join(", ")}; backend-deploy=${coverage.backendDeploys.join(", ")}; frontend-deploy=${coverage.frontendDeploys.join(", ")}; db=${coverage.databases.join(", ")}; saas-profile=${coverage.saasProviderProfiles.join(", ")}`,
  );
}

function readSmokeCoverage(cases: readonly SmokeCase[]): {
  readonly presets: readonly string[];
  readonly apis: readonly string[];
  readonly apiHosting: readonly string[];
  readonly backendDeploys: readonly string[];
  readonly frontendDeploys: readonly string[];
  readonly databases: readonly string[];
  readonly saasProviderProfiles: readonly string[];
} {
  return {
    presets: readCoveredValues(cases, "--preset", SUPPORTED_CREATE_CROCO_APP_CHOICES.presets),
    apis: readCoveredValues(cases, "--api", SUPPORTED_CREATE_CROCO_APP_CHOICES.apis),
    apiHosting: readCoveredValues(
      cases,
      "--api-hosting",
      SUPPORTED_CREATE_CROCO_APP_CHOICES.apiHosting,
    ),
    backendDeploys: readCoveredValues(
      cases,
      "--backend-deploy",
      SUPPORTED_CREATE_CROCO_APP_CHOICES.backendDeploys,
    ),
    frontendDeploys: readCoveredValues(
      cases,
      "--frontend-deploy",
      SUPPORTED_CREATE_CROCO_APP_CHOICES.frontendDeploys,
    ),
    databases: readCoveredValues(cases, "--db", SUPPORTED_CREATE_CROCO_APP_CHOICES.databases, {
      splitCommaValues: true,
    }),
    saasProviderProfiles: readCoveredValues(
      cases,
      "--saas-profile",
      SUPPORTED_CREATE_CROCO_APP_CHOICES.saasProviderProfiles,
    ),
  };
}

function readCoveredValues(
  cases: readonly SmokeCase[],
  flag: string,
  supportedValues: readonly string[],
  options: { readonly splitCommaValues?: boolean } = {},
): readonly string[] {
  const coveredValues = new Set<string>();

  for (const smokeCase of cases) {
    for (let index = 0; index < smokeCase.args.length; index += 1) {
      if (smokeCase.args[index] !== flag) continue;

      const value = smokeCase.args[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`${smokeCase.name} is missing a value after ${flag}`);
      }

      const values = options.splitCommaValues
        ? value
            .split(",")
            .map((part) => part.trim())
            .filter(Boolean)
        : [value];

      for (const coveredValue of values) {
        coveredValues.add(coveredValue);
      }
    }
  }

  const unsupportedValues = [...coveredValues].filter(
    (coveredValue) => !supportedValues.includes(coveredValue),
  );
  if (unsupportedValues.length > 0) {
    throw new Error(
      `${flag} smoke coverage includes unsupported values: ${unsupportedValues.join(", ")}`,
    );
  }

  return supportedValues.filter((supportedValue) => coveredValues.has(supportedValue));
}

function assertCovers(
  label: string,
  supportedValues: readonly string[],
  coveredValues: readonly string[],
): void {
  const missingValues = supportedValues.filter(
    (supportedValue) => !coveredValues.includes(supportedValue),
  );

  if (missingValues.length > 0) {
    throw new Error(
      `create-croco-app generated smoke matrix is missing ${label}: ${missingValues.join(", ")}`,
    );
  }
}

function runSpaBeSplitContractSmoke(
  workspacePackageIndex: ReadonlyMap<string, WorkspacePackage>,
  packedWorkspacePackages: Map<string, string>,
  builtWorkspacePackageNames: Set<string>,
): void {
  const projectDir = join(smokeRoot, "rest-spa-contracts");
  const templateDir = join(rootDir, "packages", "create-croco-app", "templates", "spa-be-split");

  renderTemplate(templateDir, projectDir, {
    projectName: "rest-spa-contracts",
    scope: "@smoke",
  });
  removeDependency(
    join(projectDir, "apps", "api-server", "package.json"),
    "devDependencies",
    "@croco/testing",
  );
  const contractSmokeRangeOverrides = getGeneratedSmokeRangeOverrides(
    projectDir,
    join(smokeRoot, "contract-package-packs"),
    workspacePackageIndex,
    packedWorkspacePackages,
    builtWorkspacePackageNames,
  );
  rewriteExternalCrocoRanges(
    projectDir,
    contractSmokeRangeOverrides,
    generatedSmokeExternalCrocoRangeExceptions,
  );
  writePnpmOverrides(projectDir, contractSmokeRangeOverrides);

  run("pnpm", ["install"], projectDir);
  assertPnpmLockfileUsesLocalTarballOverrides(
    join(projectDir, "pnpm-lock.yaml"),
    "rest-spa-contracts",
    contractSmokeRangeOverrides,
  );
  run("pnpm", ["contract:check"], projectDir);
  run("pnpm", ["contract:snapshot"], projectDir);
  assertExists(
    join(projectDir, "contract-graph.snapshot.json"),
    "REST SPA contract smoke did not create contract-graph.snapshot.json",
  );
  run("pnpm", ["contract:verify"], projectDir);
  assertExists(
    join(projectDir, "contract-graph.coverage.json"),
    "REST SPA contract smoke did not create contract-graph.coverage.json",
  );
  assertExists(
    join(projectDir, "openapi.json"),
    "REST SPA contract smoke did not create openapi.json",
  );

  const generatedClientPath = join(projectDir, "libs", "shared", "provider-rpc", "src", "user.ts");
  assertExists(
    generatedClientPath,
    "REST SPA contract smoke did not create provider-rpc user client",
  );
  assertFileContains(
    generatedClientPath,
    "export function useList<TData = ListOutput>(options?: ListQueryOptions<TData>)",
  );
  assertFileContains(
    generatedClientPath,
    "export type CreateInput = { email: string; name: string; };",
  );
  console.log("create-croco-app-generated-smoke: rest-spa-contracts contract commands passed");
}

function getGeneratedSmokeRangeOverrides(
  projectDir: string,
  packDir: string,
  workspacePackageIndex: ReadonlyMap<string, WorkspacePackage>,
  packedWorkspacePackages: Map<string, string>,
  builtWorkspacePackageNames: Set<string>,
): Record<string, string> {
  const workspacePackages = resolveLocalCrocoPackagesForGeneratedProject(
    projectDir,
    workspacePackageIndex,
    generatedSmokeExternalCrocoRangeExceptions,
  );

  buildWorkspacePackages(
    workspacePackages.map(({ name }) => name),
    builtWorkspacePackageNames,
  );

  return Object.fromEntries(
    workspacePackages.map((workspacePackage) => [
      workspacePackage.name,
      `file:${packWorkspacePackage(workspacePackage, packDir, packedWorkspacePackages)}`,
    ]),
  );
}

function buildWorkspacePackages(
  packageNames: readonly string[],
  builtWorkspacePackageNames: Set<string>,
): void {
  const packageNamesToBuild = [...new Set(packageNames)]
    .filter((packageName) => !builtWorkspacePackageNames.has(packageName))
    .sort();

  if (packageNamesToBuild.length === 0) {
    return;
  }

  run(
    process.execPath,
    [turboPath, "build", ...packageNamesToBuild.map((packageName) => `--filter=${packageName}...`)],
    rootDir,
  );

  for (const packageName of packageNamesToBuild) {
    builtWorkspacePackageNames.add(packageName);
  }
}

function packWorkspacePackage(
  workspacePackage: WorkspacePackage,
  packDir: string,
  packedWorkspacePackages: Map<string, string>,
): string {
  const cachedTarballPath = packedWorkspacePackages.get(workspacePackage.name);
  if (cachedTarballPath) {
    return cachedTarballPath;
  }

  mkdirSync(packDir, { recursive: true });
  run("pnpm", ["--filter", workspacePackage.name, "pack", "--pack-destination", packDir], rootDir);

  const tarballPath = join(
    packDir,
    `${workspacePackage.name.replace(/^@/, "").replace("/", "-")}-${workspacePackage.version}.tgz`,
  );
  packedWorkspacePackages.set(workspacePackage.name, tarballPath);

  return tarballPath;
}

function writePnpmOverrides(projectDir: string, rangeOverrides: Record<string, string>): void {
  const manifestPath = join(projectDir, "package.json");
  const packageJson = JSON.parse(readFileSync(manifestPath, "utf8")) as Record<string, unknown>;
  const pnpmConfig = isRecord(packageJson.pnpm) ? packageJson.pnpm : {};
  const existingOverrides = isDependencyMap(pnpmConfig.overrides) ? pnpmConfig.overrides : {};

  packageJson.pnpm = {
    ...pnpmConfig,
    overrides: {
      ...existingOverrides,
      ...rangeOverrides,
    },
  };

  writeFileSync(manifestPath, `${JSON.stringify(packageJson, null, 2)}\n`);
}

function assertPnpmLockfileUsesLocalTarballOverrides(
  lockfilePath: string,
  label: string,
  rangeOverrides: Record<string, string>,
): void {
  const lockfile = readFileSync(lockfilePath, "utf8");
  const missingLocalTarballPackages = Object.entries(rangeOverrides)
    .filter(([, range]) => !lockfile.includes(range))
    .map(([packageName]) => packageName);

  if (missingLocalTarballPackages.length > 0) {
    throw new Error(
      `${label} pnpm lockfile is missing local tarball references for ${missingLocalTarballPackages.join(", ")}`,
    );
  }
}

function renderTemplate(sourceDir: string, targetDir: string, vars: Record<string, string>): void {
  mkdirSync(targetDir, { recursive: true });

  for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = join(sourceDir, entry.name);
    const targetName = entry.name.endsWith(".hbs") ? entry.name.slice(0, -4) : entry.name;
    const targetPath = join(targetDir, targetName);

    if (entry.isDirectory()) {
      renderTemplate(sourcePath, targetPath, vars);
      continue;
    }

    if (isTextFile(sourcePath)) {
      const rendered = renderText(readFileSync(sourcePath, "utf8"), vars);
      writeFileSync(targetPath, rendered);
      continue;
    }

    copyFileSync(sourcePath, targetPath);
  }
}

function isTextFile(path: string): boolean {
  return !readFileSync(path).includes(0);
}

function renderText(content: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (rendered, [key, value]) => rendered.split(`{{${key}}}`).join(value),
    content,
  );
}

function removeDependency(path: string, field: DependencyField, packageName: string): void {
  const packageJson = JSON.parse(readFileSync(path, "utf8")) as PackageJson;
  const dependencies = packageJson[field];

  if (!isDependencyMap(dependencies) || !(packageName in dependencies)) {
    return;
  }

  delete dependencies[packageName];
  writeFileSync(path, `${JSON.stringify(packageJson, null, 2)}\n`);
}

function isDependencyMap(value: unknown): value is Record<string, string> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  return Object.values(value).every((dependencyRange) => typeof dependencyRange === "string");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertFileContains(path: string, expected: string): void {
  const content = readFileSync(path, "utf8");

  if (!content.includes(expected)) {
    throw new Error(`${path} did not include expected text: ${expected}`);
  }
}

function assertJsonMatches(path: string, expected: Record<string, unknown>, label: string): void {
  assertExists(path, `${label} did not create ${path}`);
  const actual = JSON.parse(readFileSync(path, "utf8")) as unknown;

  if (!isRecord(actual)) {
    throw new Error(`${label} JSON ${path} is not an object`);
  }

  for (const [key, expectedValue] of Object.entries(expected)) {
    const actualValue = actual[key];

    if (JSON.stringify(actualValue) !== JSON.stringify(expectedValue)) {
      throw new Error(
        `${label} JSON ${path} expected ${key}=${JSON.stringify(expectedValue)} but got ${JSON.stringify(actualValue)}`,
      );
    }
  }
}

function run(
  command: string,
  args: readonly string[],
  cwd: string,
  env?: Readonly<Record<string, string>>,
): void {
  const result = spawnSync(command, [...args], {
    cwd,
    env: env ? { ...process.env, ...env } : undefined,
    stdio: "inherit",
    timeout: commandTimeoutMs,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}`);
  }
}

function runExpectFailure(
  command: string,
  args: readonly string[],
  cwd: string,
  expectedOutput: readonly string[],
  env?: Readonly<Record<string, string>>,
): void {
  const result = spawnSync(command, [...args], {
    cwd,
    encoding: "utf8",
    env: env ? { ...process.env, ...env } : undefined,
    timeout: commandTimeoutMs,
  });

  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;

  if (result.error) {
    throw result.error;
  }

  if (result.status === 0) {
    throw new Error(`${command} ${args.join(" ")} was expected to fail but exited 0`);
  }

  for (const expectedText of expectedOutput) {
    if (!output.includes(expectedText)) {
      throw new Error(
        `${command} ${args.join(" ")} failed without expected output: ${expectedText}\n${output}`,
      );
    }
  }
}
