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
import { getExternalCrocoPackageRange } from "../packages/create-croco-app/src/helpers/croco-ranges.ts";
import { SUPPORTED_CREATE_CROCO_APP_CHOICES } from "../packages/create-croco-app/src/supported-options.ts";

type SmokeValidation = {
  readonly label: string;
  readonly packagePath?: readonly string[];
  readonly args?: readonly string[];
  readonly paths?: readonly string[];
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
const smokeRoot = mkdtempSync(join(tmpdir(), "croco-generated-app-smoke-"));
const commandTimeoutMs = 600_000;
const loadViteConfigScript = [
  'import { join } from "node:path";',
  'import { loadConfigFromFile } from "vite";',
  'const result = await loadConfigFromFile({ command: "build", mode: "production" }, join(process.cwd(), "vite.config.ts"));',
  'if (!result) throw new Error("vite.config.ts did not load");',
].join(" ");
const dependencyFields = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
] as const;

type DependencyField = (typeof dependencyFields)[number];
type PackageJson = {
  name?: unknown;
} & Partial<Record<DependencyField, unknown>>;

const smokeCases: readonly SmokeCase[] = [
  {
    name: "blank-basic",
    args: ["--preset", "blank", "--scope", "@smoke", "--no-install", "--no-git"],
    validations: [{ label: "typecheck", args: ["typecheck"] }],
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
    ],
  },
  {
    name: "saas-golden-path",
    args: ["--preset", "saas", "--scope", "@smoke", "--no-install", "--no-git"],
    validations: [
      { label: "typecheck", args: ["typecheck"] },
      { label: "build", args: ["build"] },
      { label: "test", args: ["test"] },
      { label: "OpenAPI contract", args: ["contract:openapi"] },
      { label: "demo flow", args: ["demo:smoke"] },
    ],
  },
];

try {
  assertSmokeCoverage(smokeCases);
  printSmokeCoverageSummary(smokeCases);

  run(
    "pnpm",
    [
      "build",
      "--filter=create-croco-app...",
      "--filter=@croco/frontend-vite...",
      "--filter=@croco/openapi-spec...",
      "--filter=@croco/problems-core...",
      "--filter=@croco/rpc-codegen...",
      "--force",
    ],
    rootDir,
  );
  assertExists(cliPath, "create-croco-app dist CLI is missing after build");

  const generatedSmokeRangeOverrides = getGeneratedSmokeRangeOverrides();

  for (const smokeCase of smokeCases) {
    const projectDir = join(smokeRoot, smokeCase.name);

    run("node", [cliPath, projectDir, ...smokeCase.args], rootDir);
    rewriteExternalCrocoRanges(projectDir, generatedSmokeRangeOverrides);
    writePnpmOverrides(projectDir, generatedSmokeRangeOverrides);
    run("pnpm", ["install"], projectDir);
    assertExists(
      join(projectDir, "pnpm-lock.yaml"),
      `${smokeCase.name} did not create a pnpm lockfile`,
    );
    assertExists(
      join(projectDir, "node_modules"),
      `${smokeCase.name} did not install dependencies with pnpm`,
    );

    for (const validation of smokeCase.validations) {
      runValidation(projectDir, smokeCase, validation);
    }
  }

  runSpaBeSplitContractSmoke();

  console.log("create-croco-app-generated-smoke: all generated app smoke cases passed");
} finally {
  rmSync(smokeRoot, { force: true, recursive: true });
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
    run("pnpm", ["--dir", validationDir, ...validation.args], rootDir);
  }

  for (const relativePath of validation.paths ?? []) {
    assertExists(
      join(validationDir, relativePath),
      `${smokeCase.name} ${validation.label} did not create ${relativePath}`,
    );
  }

  if (!validation.args && !validation.paths) {
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
}

function printSmokeCoverageSummary(cases: readonly SmokeCase[]): void {
  const coverage = readSmokeCoverage(cases);

  console.log(
    `create-croco-app-generated-smoke: matrix cases ${cases.map(({ name }) => name).join(", ")}`,
  );
  console.log(
    `create-croco-app-generated-smoke: matrix covers presets=${coverage.presets.join(", ")}; apis=${coverage.apis.join(", ")}; api-hosting=${coverage.apiHosting.join(", ")}; backend-deploy=${coverage.backendDeploys.join(", ")}; frontend-deploy=${coverage.frontendDeploys.join(", ")}; db=${coverage.databases.join(", ")}`,
  );
}

function readSmokeCoverage(cases: readonly SmokeCase[]): {
  readonly presets: readonly string[];
  readonly apis: readonly string[];
  readonly apiHosting: readonly string[];
  readonly backendDeploys: readonly string[];
  readonly frontendDeploys: readonly string[];
  readonly databases: readonly string[];
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

function runSpaBeSplitContractSmoke(): void {
  const projectDir = join(smokeRoot, "rest-spa-contracts");
  const templateDir = join(rootDir, "packages", "create-croco-app", "templates", "spa-be-split");

  renderTemplate(templateDir, projectDir, {
    projectName: "rest-spa-contracts",
    scope: "@smoke",
  });
  const contractSmokeRangeOverrides = getContractSmokeRangeOverrides();
  rewriteExternalCrocoRanges(projectDir, contractSmokeRangeOverrides);
  writePnpmOverrides(projectDir, contractSmokeRangeOverrides);
  removeDependency(
    join(projectDir, "apps", "api-server", "package.json"),
    "devDependencies",
    "@croco/testing",
  );

  run("pnpm", ["install"], projectDir);
  run("pnpm", ["contract:check"], projectDir);
  run("pnpm", ["contract:openapi"], projectDir);
  assertExists(
    join(projectDir, "openapi.json"),
    "REST SPA contract smoke did not create openapi.json",
  );

  run("pnpm", ["contract:client"], projectDir);
  const generatedClientPath = join(projectDir, "libs", "shared", "provider-rpc", "src", "user.ts");
  assertExists(
    generatedClientPath,
    "REST SPA contract smoke did not create provider-rpc user client",
  );
  assertFileContains(generatedClientPath, "export function useList()");
  assertFileContains(
    generatedClientPath,
    "export type CreateInput = { name: string; email: string; };",
  );

  run("pnpm", ["--filter", "@smoke/provider-rpc", "typecheck"], projectDir);
  console.log("create-croco-app-generated-smoke: rest-spa-contracts contract commands passed");
}

function getGeneratedSmokeRangeOverrides(): Record<string, string> {
  const packDir = join(smokeRoot, "generated-package-packs");

  return {
    "@croco/frontend-vite": `file:${packWorkspacePackage("@croco/frontend-vite", "frontend-vite", packDir)}`,
    "@croco/problems-core": `file:${packWorkspacePackage("@croco/problems-core", "problems-core", packDir)}`,
  };
}

function getContractSmokeRangeOverrides(): Record<string, string> {
  const packDir = join(smokeRoot, "contract-package-packs");

  return {
    "@croco/openapi-spec": `file:${packWorkspacePackage("@croco/openapi-spec", "openapi-spec", packDir)}`,
    "@croco/problems-core": `file:${packWorkspacePackage("@croco/problems-core", "problems-core", packDir)}`,
    "@croco/protocols-core": `file:${packWorkspacePackage("@croco/protocols-core", "protocols-core", packDir)}`,
    "@croco/rpc-codegen": `file:${packWorkspacePackage("@croco/rpc-codegen", "rpc-codegen", packDir)}`,
  };
}

function packWorkspacePackage(
  packageName: string,
  packageDirName: string,
  packDir: string,
): string {
  mkdirSync(packDir, { recursive: true });
  run("pnpm", ["--filter", packageName, "pack", "--pack-destination", packDir], rootDir);

  const packageJson = JSON.parse(
    readFileSync(join(rootDir, "packages", packageDirName, "package.json"), "utf8"),
  ) as {
    version?: unknown;
  };

  if (typeof packageJson.version !== "string") {
    throw new Error(`${packageName} package.json is missing a string version`);
  }

  return join(
    packDir,
    `${packageName.replace(/^@/, "").replace("/", "-")}-${packageJson.version}.tgz`,
  );
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

function rewriteExternalCrocoRanges(
  projectDir: string,
  rangeOverrides: Record<string, string> = {},
): void {
  const manifests = findPackageJsonFiles(projectDir).map((path) => ({
    path,
    packageJson: JSON.parse(readFileSync(path, "utf8")) as PackageJson,
  }));
  const generatedPackageNames = new Set(
    manifests
      .map(({ packageJson }) => packageJson.name)
      .filter((name): name is string => typeof name === "string"),
  );

  for (const manifest of manifests) {
    let changed = false;

    for (const field of dependencyFields) {
      const dependencies = manifest.packageJson[field];

      if (!isDependencyMap(dependencies)) {
        continue;
      }

      for (const [packageName, range] of Object.entries(dependencies)) {
        if (!packageName.startsWith("@croco/") || generatedPackageNames.has(packageName)) {
          continue;
        }

        const rangeOverride = rangeOverrides[packageName];
        if (!range.startsWith("workspace:") && rangeOverride === undefined) {
          continue;
        }

        const publishedRange = rangeOverride ?? getExternalCrocoPackageRange(packageName);
        if (publishedRange === undefined) {
          throw new Error(`No published range configured for generated dependency ${packageName}`);
        }

        dependencies[packageName] = publishedRange;
        changed = true;
      }
    }

    if (changed) {
      writeFileSync(manifest.path, `${JSON.stringify(manifest.packageJson, null, 2)}\n`);
    }
  }
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

function findPackageJsonFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      return findPackageJsonFiles(entryPath);
    }

    return entry.name === "package.json" ? [entryPath] : [];
  });
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

function run(command: string, args: readonly string[], cwd: string): void {
  const result = spawnSync(command, [...args], {
    cwd,
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
