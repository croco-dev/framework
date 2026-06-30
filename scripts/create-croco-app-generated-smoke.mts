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
  writePnpmWorkspaceOverrides,
  type DependencyField,
  type ExternalCrocoRangeException,
  type PackageJson,
  type WorkspacePackage,
} from "./create-croco-app-generated-smoke-support.mts";
import { SUPPORTED_CREATE_CROCO_APP_CHOICES } from "../packages/create-croco-app/src/supported-options.ts";

const DEFAULT_TENANT_MODEL = "org";

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

type SmokeStepStatus = "pending" | "passed" | "failed";

type SmokeStepResult = {
  readonly label: string;
  readonly command?: string;
  readonly packagePath?: readonly string[];
  readonly paths?: readonly string[];
  readonly jsonPath?: string;
  readonly expectFailure?: boolean;
  status: SmokeStepStatus;
  diagnosticCodes: readonly string[];
  error?: string;
};

type SmokeCase = {
  readonly name: string;
  readonly args: readonly string[];
  readonly runtimeTarget: string;
  readonly matrixTargets: readonly string[];
  readonly validations: readonly SmokeValidation[];
};

type SmokeCaseResult = {
  readonly name: string;
  readonly preset: string;
  readonly runtimeTarget: string;
  readonly matrixTargets: readonly string[];
  readonly args: readonly string[];
  status: SmokeStepStatus;
  steps: SmokeStepResult[];
  error?: string;
};

type SmokeGateResult = {
  readonly label: string;
  readonly command: string;
  status: SmokeStepStatus;
  error?: string;
};

type GeneratedSmokeReport = {
  readonly schemaVersion: "croco.generated-app-smoke/v1";
  readonly generatedAt: string;
  readonly filteredRun: boolean;
  status: SmokeStepStatus;
  failure?: string;
  readonly matrix: {
    readonly coverage: ReturnType<typeof readSmokeCoverage>;
    readonly templateTargets: readonly TemplateMatrixTarget[];
    readonly templateExclusions: readonly TemplateMatrixExclusion[];
  };
  gates: SmokeGateResult[];
  cases: SmokeCaseResult[];
};

type TemplateMatrixTarget = {
  readonly template: string;
  readonly cases: readonly string[];
};

type TemplateMatrixExclusion = {
  readonly template: string;
  readonly reason: string;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, "..");
const cliPath = join(rootDir, "packages", "create-croco-app", "dist", "index.js");
const generatedAppTemplatesDir = join(rootDir, "packages", "create-croco-app", "templates");
const generatedSmokeReportDir = resolve(
  process.env.CROCO_GENERATED_SMOKE_REPORT_DIR ?? join(rootDir, "ci-reports", "generated-apps"),
);
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
const generatedTemplateMatrixExclusions = {
  "container-fullstack": {
    reason:
      "Template-only compatibility fixture is not reachable through the supported create-croco-app CLI preset or goal surface; structural coverage remains in templates-build.spec.ts until it is wired into generation.",
  },
  "ssr-lambda": {
    reason:
      "Template-only compatibility fixture is not reachable through the supported create-croco-app CLI preset or goal surface; lambda runtime coverage is exercised through graphql-lambda-api and saas-lambda-profile.",
  },
} as const satisfies Record<string, { readonly reason: string }>;

const smokeCases: readonly SmokeCase[] = [
  {
    name: "blank-basic",
    args: ["--preset", "blank", "--scope", "@smoke", "--no-install", "--no-git"],
    runtimeTarget: "node",
    matrixTargets: ["blank"],
    validations: [{ label: "typecheck", args: ["typecheck"] }],
  },
  {
    name: "goal-saas-api",
    args: ["--goal", "saas-api", "--scope", "@smoke", "--no-install", "--no-git"],
    runtimeTarget: "node",
    matrixTargets: ["saas"],
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
      { label: "failure drill smoke", args: ["failure-drill:smoke"] },
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
    runtimeTarget: "lambda",
    matrixTargets: ["base-ddd"],
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
    runtimeTarget: "node+browser",
    matrixTargets: ["base-ddd"],
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
    runtimeTarget: "opennext",
    matrixTargets: ["base-ddd"],
    validations: [
      { label: "typecheck", packagePath: ["apps", "web"], args: ["typecheck"] },
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
    runtimeTarget: "container+browser",
    matrixTargets: ["base-ddd"],
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
    runtimeTarget: "container+browser",
    matrixTargets: ["base-ddd"],
    validations: [
      {
        label: "apps/web vite config load",
        packagePath: ["apps", "web"],
        args: ["exec", "node", "--input-type=module", "--eval", loadViteConfigScript],
      },
      {
        label: "apps/web browser build output",
        packagePath: ["apps", "web"],
        args: ["build"],
        paths: ["dist/index.html", "src/vite-env.d.ts"],
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
    runtimeTarget: "cloudflare-workers+browser",
    matrixTargets: ["base-ddd"],
    validations: [
      {
        label: "apps/web vite config load",
        packagePath: ["apps", "web"],
        args: ["exec", "node", "--input-type=module", "--eval", loadViteConfigScript],
      },
      {
        label: "apps/web meta-vite build output",
        packagePath: ["apps", "web"],
        args: ["build"],
        paths: ["dist/client", "dist/client/manifest.json"],
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
    runtimeTarget: "cloudflare-workers",
    matrixTargets: ["base-ddd"],
    validations: [
      {
        label: "ssr-worker vite config load",
        packagePath: ["ssr-worker"],
        args: ["exec", "node", "--input-type=module", "--eval", loadViteConfigScript],
      },
      {
        label: "ssr-worker meta-vite build output",
        packagePath: ["ssr-worker"],
        args: ["build"],
        paths: ["dist/client", "dist/client/manifest.json"],
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
    runtimeTarget: "node+browser",
    matrixTargets: ["spa-be-split"],
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
    runtimeTarget: "node+browser",
    matrixTargets: ["admin-console", "spa-be-split"],
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
      "--tenant-model",
      "rls-backed",
      "--no-install",
      "--no-git",
    ],
    runtimeTarget: "node",
    matrixTargets: ["saas"],
    validations: [
      {
        label: "provider profile manifest",
        args: ["profile:check"],
        paths: [
          "croco-saas-profile.manifest.json",
          "croco-tenant-model.manifest.json",
          "croco-tenant-model.schema.json",
          ".env.example",
          "docs/provider-profile.md",
          "docs/tenant-model-playbook.md",
          "docs/secrets-checklist.md",
          "apps/api-server/src/generatedSaasProviderProfile.ts",
          "apps/api-server/src/generatedTenantModel.ts",
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
      { label: "doctor", args: ["exec", "croco", "doctor", "--json"] },
      { label: "demo seed", args: ["demo:seed"] },
      { label: "demo flow", args: ["demo:smoke"] },
      { label: "failure drill smoke", args: ["failure-drill:smoke"] },
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
      "--tenant-model",
      "workspace",
      "--no-install",
      "--no-git",
    ],
    runtimeTarget: "cloudflare-workers",
    matrixTargets: ["saas"],
    validations: [
      {
        label: "provider profile manifest",
        args: ["profile:check"],
        paths: [
          "croco-saas-profile.manifest.json",
          "croco-tenant-model.manifest.json",
          "croco-tenant-model.schema.json",
          ".env.example",
          "docs/provider-profile.md",
          "docs/tenant-model-playbook.md",
          "docs/secrets-checklist.md",
          "apps/api-server/src/generatedSaasProviderProfile.ts",
          "apps/api-server/src/generatedTenantModel.ts",
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
      "--tenant-model",
      "shared-schema",
      "--no-install",
      "--no-git",
    ],
    runtimeTarget: "lambda",
    matrixTargets: ["saas"],
    validations: [
      {
        label: "provider profile manifest",
        args: ["profile:check"],
        paths: [
          "croco-saas-profile.manifest.json",
          "croco-tenant-model.manifest.json",
          "croco-tenant-model.schema.json",
          ".env.example",
          "docs/provider-profile.md",
          "docs/tenant-model-playbook.md",
          "docs/secrets-checklist.md",
          "apps/api-server/src/generatedSaasProviderProfile.ts",
          "apps/api-server/src/generatedTenantModel.ts",
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
    args: [
      "--preset",
      "ai-saas",
      "--scope",
      "@smoke",
      "--tenant-model",
      "single",
      "--no-install",
      "--no-git",
    ],
    runtimeTarget: "node",
    matrixTargets: ["ai-saas", "saas"],
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
      { label: "failure drill smoke", args: ["failure-drill:smoke"] },
    ],
  },
];

let smokeReport: GeneratedSmokeReport | undefined;

try {
  const selectedSmokeCases = selectSmokeCases(smokeCases);
  const isFilteredRun = selectedSmokeCases.length !== smokeCases.length;

  if (isFilteredRun) {
    console.log(
      `create-croco-app-generated-smoke: selected cases ${selectedSmokeCases.map(({ name }) => name).join(", ")}`,
    );
  } else {
    assertSmokeCoverage(smokeCases);
    assertTemplateMatrixAccountability(smokeCases);
    printSmokeCoverageSummary(smokeCases);
  }

  smokeReport = createGeneratedSmokeReport(selectedSmokeCases, isFilteredRun);
  writeGeneratedSmokeReport(smokeReport);

  runGeneratedAppContractGates(smokeReport);

  runGateCommand(
    smokeReport,
    "workspace package build",
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
      "--filter=@croco/tenant-core...",
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
    const caseResult = getSmokeCaseResult(smokeReport, smokeCase.name);

    runSmokeCaseCommand(
      smokeReport,
      caseResult,
      "generate",
      "node",
      [cliPath, projectDir, ...smokeCase.args],
      rootDir,
    );
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
    assertGeneratedReadme(projectDir, smokeCase);
    writePnpmWorkspaceOverrides(projectDir, generatedSmokeRangeOverrides);
    runSmokeCaseCommand(
      smokeReport,
      caseResult,
      "install",
      "corepack",
      ["pnpm", "install"],
      projectDir,
    );
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
      runValidation(projectDir, smokeCase, validation, smokeReport, caseResult);
    }
    caseResult.status = "passed";
    writeGeneratedSmokeReport(smokeReport);
  }

  if (!isFilteredRun) {
    runSpaBeSplitContractSmoke(
      workspacePackageIndex,
      packedWorkspacePackages,
      builtWorkspacePackageNames,
    );
  }

  smokeReport.status = "passed";
  writeGeneratedSmokeReport(smokeReport);
  console.log("create-croco-app-generated-smoke: all generated app smoke cases passed");
} catch (error) {
  if (smokeReport) {
    smokeReport.status = "failed";
    smokeReport.failure = toErrorMessage(error);
    writeGeneratedSmokeReport(smokeReport);
  }
  throw error;
} finally {
  rmSync(smokeRoot, { force: true, recursive: true });
}

function runGeneratedAppContractGates(report: GeneratedSmokeReport): void {
  runGate("strict contract typecheck", ["strict-contract-typecheck"], report);
  runGate("static misuse check", ["static-misuse:check"], report);
  runGate(
    "generated template oxlint",
    ["exec", "oxlint", "packages/create-croco-app/templates"],
    report,
  );
}

function runGate(label: string, args: readonly string[], report: GeneratedSmokeReport): void {
  runGateCommand(report, label, "corepack", ["pnpm", ...args], rootDir);
  console.log(`create-croco-app-generated-smoke: ${label} passed`);
}

function createGeneratedSmokeReport(
  cases: readonly SmokeCase[],
  isFilteredRun: boolean,
): GeneratedSmokeReport {
  return {
    schemaVersion: "croco.generated-app-smoke/v1",
    generatedAt: new Date().toISOString(),
    filteredRun: isFilteredRun,
    status: "pending",
    matrix: {
      coverage: readSmokeCoverage(cases),
      templateTargets: readTemplateMatrixTargets(cases),
      templateExclusions: readTemplateMatrixExclusions(),
    },
    gates: [],
    cases: cases.map((smokeCase) => ({
      name: smokeCase.name,
      preset: readSmokeCasePreset(smokeCase),
      runtimeTarget: smokeCase.runtimeTarget,
      matrixTargets: smokeCase.matrixTargets,
      args: smokeCase.args,
      status: "pending",
      steps: [],
    })),
  };
}

function writeGeneratedSmokeReport(report: GeneratedSmokeReport): void {
  mkdirSync(generatedSmokeReportDir, { recursive: true });
  writeFileSync(
    join(generatedSmokeReportDir, "matrix.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  writeFileSync(join(generatedSmokeReportDir, "matrix.md"), renderGeneratedSmokeReport(report));
}

function renderGeneratedSmokeReport(report: GeneratedSmokeReport): string {
  const lines = [
    "# Generated app smoke matrix",
    "",
    `- Status: ${report.status}`,
    `- Generated at: ${report.generatedAt}`,
    `- Filtered run: ${report.filteredRun ? "yes" : "no"}`,
    "",
    "## Coverage",
    "",
    `- Presets: ${formatList(report.matrix.coverage.presets)}`,
    `- APIs: ${formatList(report.matrix.coverage.apis)}`,
    `- API hosting: ${formatList(report.matrix.coverage.apiHosting)}`,
    `- Backend deploy: ${formatList(report.matrix.coverage.backendDeploys)}`,
    `- Frontend deploy: ${formatList(report.matrix.coverage.frontendDeploys)}`,
    `- DB: ${formatList(report.matrix.coverage.databases)}`,
    `- SaaS profile: ${formatList(report.matrix.coverage.saasProviderProfiles)}`,
    `- Tenant model: ${formatList(report.matrix.coverage.tenantModels)}`,
    "",
    "## Template accountability",
    "",
    "| Template | Status | Evidence |",
    "| --- | --- | --- |",
    ...report.matrix.templateTargets.map(
      (target) =>
        `| \`${target.template}\` | covered | ${target.cases.map((name) => `\`${name}\``).join(", ")} |`,
    ),
    ...report.matrix.templateExclusions.map(
      (exclusion) =>
        `| \`${exclusion.template}\` | excluded | ${escapeMarkdownTable(exclusion.reason)} |`,
    ),
    "",
    "## Gates",
    "",
    "| Gate | Status | Command |",
    "| --- | --- | --- |",
    ...report.gates.map(
      (gate) =>
        `| ${escapeMarkdownTable(gate.label)} | ${gate.status} | \`${escapeBackticks(gate.command)}\` |`,
    ),
    "",
    "## Cases",
    "",
    "| Case | Preset/goal | Runtime target | Templates | Status |",
    "| --- | --- | --- | --- | --- |",
    ...report.cases.map(
      (smokeCase) =>
        `| \`${smokeCase.name}\` | \`${smokeCase.preset}\` | \`${smokeCase.runtimeTarget}\` | ${smokeCase.matrixTargets.map((target) => `\`${target}\``).join(", ")} | ${smokeCase.status} |`,
    ),
  ];

  if (report.failure) {
    lines.push("", "## Failure", "", report.failure);
  }

  lines.push("", "## Case steps", "");
  for (const smokeCase of report.cases) {
    lines.push(`### ${smokeCase.name}`, "");
    if (smokeCase.steps.length === 0) {
      lines.push("_No steps recorded yet._", "");
      continue;
    }
    lines.push("| Step | Status | Command | Diagnostics |", "| --- | --- | --- | --- |");
    for (const step of smokeCase.steps) {
      lines.push(
        `| ${escapeMarkdownTable(step.label)} | ${step.status} | ${step.command ? `\`${escapeBackticks(step.command)}\`` : "-"} | ${formatList(step.diagnosticCodes)} |`,
      );
    }
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

function formatList(values: readonly string[]): string {
  return values.length > 0 ? values.map((value) => `\`${value}\``).join(", ") : "_none_";
}

function escapeMarkdownTable(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function escapeBackticks(value: string): string {
  return value.replace(/`/g, "\\`");
}

function readTemplateMatrixTargets(cases: readonly SmokeCase[]): readonly TemplateMatrixTarget[] {
  const targetCases = new Map<string, string[]>();

  for (const smokeCase of cases) {
    for (const target of smokeCase.matrixTargets) {
      const caseNames = targetCases.get(target) ?? [];
      caseNames.push(smokeCase.name);
      targetCases.set(target, caseNames);
    }
  }

  return [...targetCases.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([template, caseNames]) => ({
      template,
      cases: caseNames.sort((left, right) => left.localeCompare(right)),
    }));
}

function readTemplateMatrixExclusions(): readonly TemplateMatrixExclusion[] {
  return Object.entries(generatedTemplateMatrixExclusions)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([template, exclusion]) => ({
      template,
      reason: exclusion.reason,
    }));
}

function assertTemplateMatrixAccountability(cases: readonly SmokeCase[]): void {
  const coveredTemplates = new Set(cases.flatMap(({ matrixTargets }) => matrixTargets));
  const excludedTemplates = new Set(Object.keys(generatedTemplateMatrixExclusions));
  const topLevelTemplateDirectories = readdirSync(generatedAppTemplatesDir, {
    withFileTypes: true,
  })
    .filter((entry) => entry.isDirectory() && entry.name !== "addons")
    .map((entry) => entry.name)
    .sort();

  const missingTemplates = topLevelTemplateDirectories.filter(
    (template) => !coveredTemplates.has(template) && !excludedTemplates.has(template),
  );
  if (missingTemplates.length > 0) {
    throw new Error(
      `create-croco-app generated smoke matrix is missing template accountability entries: ${missingTemplates.join(", ")}`,
    );
  }

  const knownTemplates = new Set(topLevelTemplateDirectories);
  const unknownTargets = [...coveredTemplates, ...excludedTemplates].filter(
    (template) => !knownTemplates.has(template),
  );
  if (unknownTargets.length > 0) {
    throw new Error(
      `create-croco-app generated smoke matrix references unknown template directories: ${unknownTargets.join(", ")}`,
    );
  }
}

function getSmokeCaseResult(report: GeneratedSmokeReport, caseName: string): SmokeCaseResult {
  const result = report.cases.find(({ name }) => name === caseName);
  if (!result) {
    throw new Error(`Missing generated smoke report entry for ${caseName}`);
  }
  return result;
}

function runGateCommand(
  report: GeneratedSmokeReport,
  label: string,
  command: string,
  args: readonly string[],
  cwd: string,
): void {
  const result: SmokeGateResult = {
    label,
    command: formatCommand(command, args, cwd),
    status: "pending",
  };
  report.gates.push(result);
  writeGeneratedSmokeReport(report);

  try {
    run(command, args, cwd);
    result.status = "passed";
    writeGeneratedSmokeReport(report);
  } catch (error) {
    result.status = "failed";
    result.error = toErrorMessage(error);
    report.status = "failed";
    report.failure = result.error;
    writeGeneratedSmokeReport(report);
    throw error;
  }
}

function runSmokeCaseCommand(
  report: GeneratedSmokeReport,
  caseResult: SmokeCaseResult,
  label: string,
  command: string,
  args: readonly string[],
  cwd: string,
  env?: Readonly<Record<string, string>>,
): void {
  const step = createSmokeStep(label, {
    command: formatCommand(command, args, cwd),
  });
  caseResult.steps.push(step);
  writeGeneratedSmokeReport(report);

  try {
    run(command, args, cwd, env);
    step.status = "passed";
    writeGeneratedSmokeReport(report);
  } catch (error) {
    recordSmokeCaseFailure(report, caseResult, step, error);
    throw createSmokeFailureError(caseResult, step, error);
  }
}

function createSmokeStep(
  label: string,
  options: {
    readonly command?: string;
    readonly packagePath?: readonly string[];
    readonly paths?: readonly string[];
    readonly jsonPath?: string;
    readonly expectFailure?: boolean;
  } = {},
): SmokeStepResult {
  return {
    label,
    command: options.command,
    packagePath: options.packagePath,
    paths: options.paths,
    jsonPath: options.jsonPath,
    expectFailure: options.expectFailure,
    status: "pending",
    diagnosticCodes: [],
  };
}

function recordSmokeCaseFailure(
  report: GeneratedSmokeReport,
  caseResult: SmokeCaseResult,
  step: SmokeStepResult,
  error: unknown,
): void {
  step.status = "failed";
  step.error = toErrorMessage(error);
  step.diagnosticCodes = extractDiagnosticCodes(step.error);
  caseResult.status = "failed";
  caseResult.error = step.error;
  report.status = "failed";
  report.failure = createSmokeFailureMessage(caseResult, step, error);
  writeGeneratedSmokeReport(report);
}

function createSmokeFailureError(
  caseResult: SmokeCaseResult,
  step: SmokeStepResult,
  error: unknown,
): Error {
  return new Error(createSmokeFailureMessage(caseResult, step, error), {
    cause: error,
  });
}

function createSmokeFailureMessage(
  caseResult: SmokeCaseResult,
  step: SmokeStepResult,
  error: unknown,
): string {
  const diagnosticCodes =
    step.diagnosticCodes.length > 0 ? step.diagnosticCodes.join(", ") : "none";
  return [
    `Generated app smoke failed for ${caseResult.name}.`,
    `preset=${caseResult.preset}`,
    `runtimeTarget=${caseResult.runtimeTarget}`,
    `step=${step.label}`,
    `command=${step.command ?? "n/a"}`,
    `diagnosticCodes=${diagnosticCodes}`,
    `error=${toErrorMessage(error)}`,
  ].join(" ");
}

function formatCommand(command: string, args: readonly string[], cwd: string): string {
  const relativeCwd = cwd.startsWith(rootDir) ? cwd.slice(rootDir.length + 1) || "." : cwd;
  return `(cd ${relativeCwd} && ${[command, ...args].join(" ")})`;
}

function readSmokeCasePreset(smokeCase: SmokeCase): string {
  const preset = readFlagValue(smokeCase.args, "--preset");
  if (preset) {
    return preset;
  }

  const goal = readFlagValue(smokeCase.args, "--goal");
  return goal ? `goal:${goal}` : "unknown";
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function extractDiagnosticCodes(output: string): readonly string[] {
  return [
    ...new Set(output.match(/\b(?:CROCO_[A-Z0-9_]+|[a-z0-9-]+\/[a-z0-9-]+)\b/g) ?? []),
  ].sort();
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

function assertGeneratedReadme(projectDir: string, smokeCase: SmokeCase): void {
  const readmePath = join(projectDir, "README.md");
  assertExists(readmePath, `${smokeCase.name} did not generate README.md`);

  const readme = readFileSync(readmePath, "utf8");
  if (readme.includes("{{") || readme.includes("}}")) {
    throw new Error(`${smokeCase.name} generated README.md with unresolved template placeholders`);
  }

  console.log(`create-croco-app-generated-smoke: ${smokeCase.name} README.md exists`);
}

function runValidation(
  projectDir: string,
  smokeCase: SmokeCase,
  validation: SmokeValidation,
  report: GeneratedSmokeReport,
  caseResult: SmokeCaseResult,
): void {
  const validationDir = validation.packagePath
    ? join(projectDir, ...validation.packagePath)
    : projectDir;
  const step = createSmokeStep(validation.label, {
    command: validation.args
      ? formatCommand("corepack", ["pnpm", "--dir", validationDir, ...validation.args], rootDir)
      : undefined,
    packagePath: validation.packagePath,
    paths: validation.paths,
    jsonPath: validation.json?.path,
    expectFailure: validation.expectFailure !== undefined,
  });
  caseResult.steps.push(step);
  writeGeneratedSmokeReport(report);

  try {
    if (validation.args) {
      if (validation.expectFailure) {
        step.diagnosticCodes = runExpectFailure(
          "corepack",
          ["pnpm", "--dir", validationDir, ...validation.args],
          rootDir,
          validation.expectFailure.outputIncludes,
          validation.env,
        );
      } else {
        run(
          "corepack",
          ["pnpm", "--dir", validationDir, ...validation.args],
          rootDir,
          validation.env,
        );
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

    step.status = "passed";
    writeGeneratedSmokeReport(report);
  } catch (error) {
    recordSmokeCaseFailure(report, caseResult, step, error);
    throw createSmokeFailureError(caseResult, step, error);
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
  assertCovers(
    "tenant-model",
    SUPPORTED_CREATE_CROCO_APP_CHOICES.tenantModels,
    coverage.tenantModels,
  );
}

function printSmokeCoverageSummary(cases: readonly SmokeCase[]): void {
  const coverage = readSmokeCoverage(cases);
  const templateTargets = readTemplateMatrixTargets(cases);
  const templateExclusions = readTemplateMatrixExclusions();

  console.log(
    `create-croco-app-generated-smoke: matrix cases ${cases.map(({ name }) => name).join(", ")}`,
  );
  console.log(
    `create-croco-app-generated-smoke: matrix covers presets=${coverage.presets.join(", ")}; apis=${coverage.apis.join(", ")}; api-hosting=${coverage.apiHosting.join(", ")}; backend-deploy=${coverage.backendDeploys.join(", ")}; frontend-deploy=${coverage.frontendDeploys.join(", ")}; db=${coverage.databases.join(", ")}; saas-profile=${coverage.saasProviderProfiles.join(", ")}; tenant-model=${coverage.tenantModels.join(", ")}`,
  );
  console.log(
    `create-croco-app-generated-smoke: template targets ${templateTargets.map(({ template }) => template).join(", ")}`,
  );
  console.log(
    `create-croco-app-generated-smoke: template exclusions ${templateExclusions.map(({ template }) => template).join(", ")}`,
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
  readonly tenantModels: readonly string[];
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
    tenantModels: readCoveredTenantModels(cases),
  };
}

function readCoveredTenantModels(cases: readonly SmokeCase[]): readonly string[] {
  const coveredTenantModels = new Set(
    readCoveredValues(cases, "--tenant-model", SUPPORTED_CREATE_CROCO_APP_CHOICES.tenantModels),
  );

  for (const smokeCase of cases) {
    const preset = readFlagValue(smokeCase.args, "--preset");
    const goal = readFlagValue(smokeCase.args, "--goal");
    const hasTenantModel = readFlagValue(smokeCase.args, "--tenant-model") !== undefined;

    if (!hasTenantModel && (preset === "saas" || preset === "ai-saas" || goal === "saas-api")) {
      coveredTenantModels.add(DEFAULT_TENANT_MODEL);
    }
  }

  return SUPPORTED_CREATE_CROCO_APP_CHOICES.tenantModels.filter((tenantModel) =>
    coveredTenantModels.has(tenantModel),
  );
}

function readFlagValue(args: readonly string[], flag: string): string | undefined {
  const flagIndex = args.indexOf(flag);
  if (flagIndex === -1) return undefined;

  const value = args[flagIndex + 1];
  return value && !value.startsWith("--") ? value : undefined;
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
  writePnpmWorkspaceOverrides(projectDir, contractSmokeRangeOverrides);

  run("corepack", ["pnpm", "install"], projectDir);
  assertPnpmLockfileUsesLocalTarballOverrides(
    join(projectDir, "pnpm-lock.yaml"),
    "rest-spa-contracts",
    contractSmokeRangeOverrides,
  );
  run("corepack", ["pnpm", "contract:check"], projectDir);
  run("corepack", ["pnpm", "contract:snapshot"], projectDir);
  assertExists(
    join(projectDir, "contract-graph.snapshot.json"),
    "REST SPA contract smoke did not create contract-graph.snapshot.json",
  );
  run("corepack", ["pnpm", "contract:verify"], projectDir);
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
  run(
    "corepack",
    ["pnpm", "--filter", workspacePackage.name, "pack", "--pack-destination", packDir],
    rootDir,
  );

  const tarballPath = join(
    packDir,
    `${workspacePackage.name.replace(/^@/, "").replace("/", "-")}-${workspacePackage.version}.tgz`,
  );
  packedWorkspacePackages.set(workspacePackage.name, tarballPath);

  return tarballPath;
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
): readonly string[] {
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

  return extractDiagnosticCodes(output);
}
