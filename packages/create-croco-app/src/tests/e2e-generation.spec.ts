import { existsSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { basename, extname, join, relative } from "node:path";
import { preProcessFile } from "typescript";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { generate } from "../generator.js";
import { InvalidGoalOptionProblem } from "../libs/problems/InvalidGoalOptionProblem.js";
import { normalizeNonInteractiveOptions, parseCliOptions } from "../options.js";
import type { GeneratorOptions } from "../types.js";

const DEPENDENCY_FIELDS = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
] as const;
const SOURCE_FILE_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
]);
const IMPORT_SPECIFIER_PATTERN =
  /\b(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?["']([^"']+)["']/g;
const DYNAMIC_IMPORT_SPECIFIER_PATTERN = /\bimport\(\s*["']([^"']+)["']\s*\)/g;

type DependencyField = (typeof DEPENDENCY_FIELDS)[number];
type PackageJson = {
  name?: string;
  scripts?: Record<string, string>;
} & Partial<Record<DependencyField, Record<string, string>>>;

function collectFiles(directory: string): string[] {
  return readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name));
}

function isTextFile(filePath: string): boolean {
  return !readFileSync(filePath).includes(0);
}

function assertNoHandlebarsPlaceholders(projectDir: string): void {
  const filesWithPlaceholders = collectFiles(projectDir)
    .filter(isTextFile)
    .filter((filePath) => {
      const content = readFileSync(filePath, "utf8");

      return content.includes("{{") || content.includes("}}");
    })
    .map((filePath) => relative(projectDir, filePath));

  expect(filesWithPlaceholders).toEqual([]);
}

function assertNoTailwindReferences(projectDir: string): void {
  const filesWithTailwindReferences = collectFiles(projectDir)
    .filter(isTextFile)
    .filter((filePath) => readFileSync(filePath, "utf8").toLowerCase().includes("tailwind"))
    .map((filePath) => relative(projectDir, filePath));

  expect(filesWithTailwindReferences).toEqual([]);
}

function collectPackageNames(projectDir: string): Set<string> {
  return new Set(
    collectFiles(projectDir)
      .filter((filePath) => filePath.endsWith("package.json"))
      .map((filePath) => JSON.parse(readFileSync(filePath, "utf8")).name as string),
  );
}

function collectDockerPackageFilters(projectDir: string): string[] {
  return collectFiles(projectDir)
    .filter((filePath) => filePath.endsWith("Dockerfile") || filePath.includes("Dockerfile."))
    .flatMap((filePath) => {
      const content = readFileSync(filePath, "utf8");

      return [...content.matchAll(/(?:turbo prune\s+|--filter=)(@[^\s]+)/g)].map(
        (match) => match[1],
      );
    });
}

function assertDockerFiltersMatchPackages(projectDir: string): void {
  const packageNames = collectPackageNames(projectDir);
  const dockerFilters = collectDockerPackageFilters(projectDir);

  expect(dockerFilters.length).toBeGreaterThan(0);
  for (const dockerFilter of dockerFilters) {
    expect(packageNames.has(dockerFilter)).toBe(true);
  }
}

function readSstHandlerPath(projectDir: string): string {
  const sstConfig = readFileSync(join(projectDir, "sst.config.ts"), "utf8");
  const match = sstConfig.match(/handler:\s*["']([^"']+)["']/);
  const handlerPath = match?.[1];

  if (typeof handlerPath !== "string") {
    throw new Error("Generated sst.config.ts is missing an SST function handler path");
  }

  return handlerPath;
}

function assertLambdaHandlerTarget(projectDir: string, expectedHandlerPath: string): void {
  const handlerPath = readSstHandlerPath(projectDir);
  const handlerModulePath = handlerPath.replace(/\.[^.]+$/, ".ts");
  const handlerFilePath = join(projectDir, handlerModulePath);

  expect(handlerPath).toBe(expectedHandlerPath);
  expect(existsSync(handlerFilePath)).toBe(true);
  expect(readFileSync(handlerFilePath, "utf8")).toMatch(
    /\bexport\s+(const|async function|function)\s+handler\b/,
  );
}

function readPackageJson(filePath: string): PackageJson {
  return JSON.parse(readFileSync(filePath, "utf8")) as PackageJson;
}

function toPackageName(specifier: string): string | undefined {
  if (
    specifier.length === 0 ||
    specifier.startsWith(".") ||
    specifier.startsWith("/") ||
    specifier.startsWith("node:")
  ) {
    return undefined;
  }

  const parts = specifier.split("/");

  return specifier.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
}

function collectBarePackageImports(filePath: string): string[] {
  const imports = preProcessFile(readFileSync(filePath, "utf8"), true, true)
    .importedFiles.map(({ fileName }) => toPackageName(fileName))
    .filter((packageName): packageName is string => packageName !== undefined);

  return [...new Set(imports)];
}

function collectImportSpecifiers(content: string): string[] {
  return [
    ...content.matchAll(IMPORT_SPECIFIER_PATTERN),
    ...content.matchAll(DYNAMIC_IMPORT_SPECIFIER_PATTERN),
  ].map((match) => match[1]);
}

function assertViteConfigImportsDeclared(packageDir: string): void {
  const packageJson = readPackageJson(join(packageDir, "package.json"));
  const declaredDependencies = new Set(
    DEPENDENCY_FIELDS.flatMap((field) => Object.keys(packageJson[field] ?? {})),
  );
  const importedPackages = collectBarePackageImports(join(packageDir, "vite.config.ts"));
  const missingPackages = importedPackages.filter(
    (packageName) => !declaredDependencies.has(packageName),
  );

  expect(importedPackages).not.toEqual([]);
  expect(missingPackages).toEqual([]);
}

function assertSourceBareImportsDeclared(packageDir: string): void {
  const packageJson = readPackageJson(join(packageDir, "package.json"));
  const declaredDependencies = new Set(
    DEPENDENCY_FIELDS.flatMap((field) => Object.keys(packageJson[field] ?? {})),
  );
  const missingDependencies = collectFiles(join(packageDir, "src"))
    .filter((filePath) => SOURCE_FILE_EXTENSIONS.has(extname(filePath)))
    .flatMap((filePath) =>
      collectImportSpecifiers(readFileSync(filePath, "utf8"))
        .map(toPackageName)
        .filter((packageName): packageName is string => packageName !== undefined)
        .filter((packageName) => !declaredDependencies.has(packageName))
        .map((packageName) => ({
          filePath: relative(packageDir, filePath),
          packageName,
        })),
    );

  expect(missingDependencies).toEqual([]);
}

function assertAllSourceBareImportsDeclared(projectDir: string): void {
  const packageDirs = collectFiles(projectDir)
    .filter((filePath) => filePath.endsWith("package.json"))
    .map((filePath) => filePath.slice(0, -"package.json".length - 1))
    .filter((packageDir) => existsSync(join(packageDir, "src")));

  for (const packageDir of packageDirs) {
    assertSourceBareImportsDeclared(packageDir);
  }
}

function assertStylexNextWebApp(webDir: string): void {
  const packageJson = readPackageJson(join(webDir, "package.json"));
  const globalsCss = readFileSync(join(webDir, "src", "app", "globals.css"), "utf8");
  const pageSource = readFileSync(join(webDir, "src", "app", "page.tsx"), "utf8");

  expect(packageJson.dependencies?.["@stylexjs/stylex"]).toBe("^0.19.0");
  expect(packageJson.devDependencies?.["@stylexjs/babel-plugin"]).toBe("^0.19.0");
  expect(packageJson.devDependencies?.["@stylexjs/postcss-plugin"]).toBe("^0.19.0");
  expect(packageJson.dependencies?.["tailwindcss"]).toBeUndefined();
  expect(packageJson.devDependencies?.["tailwindcss"]).toBeUndefined();
  expect(packageJson.dependencies?.["@tailwindcss/postcss"]).toBeUndefined();
  expect(packageJson.devDependencies?.["@tailwindcss/postcss"]).toBeUndefined();
  expect(existsSync(join(webDir, "babel.config.js"))).toBe(true);
  expect(existsSync(join(webDir, "postcss.config.js"))).toBe(true);
  expect(existsSync(join(webDir, "tailwind.config.ts"))).toBe(false);
  expect(existsSync(join(webDir, "tailwind.config.js"))).toBe(false);
  expect(existsSync(join(webDir, "tailwind.config.cjs"))).toBe(false);
  expect(existsSync(join(webDir, "tailwind.config.mjs"))).toBe(false);
  expect(globalsCss).toContain("@stylex");
  expect(globalsCss).not.toContain("tailwind");
  expect(pageSource).toContain("@stylexjs/stylex");
  expect(pageSource).toContain("stylex.props");
}

function assertNoExternalCrocoWorkspaceRanges(projectDir: string): void {
  const manifests = collectFiles(projectDir)
    .filter((filePath) => basename(filePath) === "package.json")
    .map((filePath) => ({
      filePath,
      packageJson: readPackageJson(filePath),
    }));
  const generatedPackageNames = new Set(
    manifests
      .map(({ packageJson }) => packageJson.name)
      .filter((name): name is string => typeof name === "string"),
  );
  const externalWorkspaceRanges = manifests.flatMap(({ filePath, packageJson }) =>
    DEPENDENCY_FIELDS.flatMap((field) =>
      Object.entries(packageJson[field] ?? {})
        .filter(
          ([packageName, range]) =>
            packageName.startsWith("@croco/") &&
            range.startsWith("workspace:") &&
            !generatedPackageNames.has(packageName),
        )
        .map(([packageName, range]) => ({
          filePath: relative(projectDir, filePath),
          packageName,
          range,
        })),
    ),
  );

  expect(externalWorkspaceRanges).toEqual([]);
}

describe("E2E: generate()", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = `/tmp/croco-e2e-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("generates blank project", { timeout: 120_000 }, async () => {
    const options: GeneratorOptions = {
      projectName: "my-blank",
      scope: "@test",
      preset: "blank",
      webApps: [],
      apiHosting: "standalone",
      db: [],
      agentRules: false,
      installDeps: false,
      initGit: false,
    };

    await generate(testDir, options);

    expect(existsSync(join(testDir, "package.json"))).toBe(true);
    expect(existsSync(join(testDir, "pnpm-workspace.yaml"))).toBe(true);
    expect(existsSync(join(testDir, "turbo.json"))).toBe(true);
    expect(existsSync(join(testDir, "tsconfig.json"))).toBe(true);
  });

  it("rejects mismatched goal generator options before creating the target directory", async () => {
    const options: GeneratorOptions = {
      projectName: "mismatched-goal",
      scope: "@test",
      goal: "saas-api",
      preset: "production-app",
      webApps: [],
      apiHosting: "standalone",
      db: [],
      agentRules: false,
      installDeps: false,
      initGit: false,
    };

    let error: unknown;
    try {
      await generate(testDir, options);
    } catch (err) {
      error = err;
    }

    expect(error).toBeInstanceOf(InvalidGoalOptionProblem);
    expect(error).toMatchObject({
      code: "create-croco-app/invalid-goal-option",
    });
    expect(existsSync(testDir)).toBe(false);
  });

  it(
    "generates ddd-fullstack with graphql standalone + docker + postgres",
    { timeout: 120_000 },
    async () => {
      const options: GeneratorOptions = {
        projectName: "my-fullstack",
        scope: "@test",
        preset: "ddd-fullstack",
        webApps: ["web"],
        api: "graphql",
        apiHosting: "standalone",
        backendDeploy: "docker",
        db: ["postgres"],
        agentRules: false,
        installDeps: false,
        initGit: false,
      };

      await generate(testDir, options);

      // Base DDD structure
      expect(existsSync(join(testDir, "package.json"))).toBe(true);
      expect(existsSync(join(testDir, "pnpm-workspace.yaml"))).toBe(true);
      expect(existsSync(join(testDir, "libs", "shared"))).toBe(true);

      // GraphQL standalone API
      expect(existsSync(join(testDir, "apps", "graphql-api"))).toBe(true);

      // Web app (web-graphql addon)
      expect(existsSync(join(testDir, "apps", "web"))).toBe(true);
      assertStylexNextWebApp(join(testDir, "apps", "web"));

      // Docker files
      expect(existsSync(join(testDir, "docker-compose.yml"))).toBe(true);
      expect(existsSync(join(testDir, ".dockerignore"))).toBe(true);
      const apiDockerfileContent = readFileSync(
        join(testDir, "apps", "graphql-api", "Dockerfile"),
        "utf8",
      );
      const graphqlPackageJson = readPackageJson(
        join(testDir, "apps", "graphql-api", "package.json"),
      );
      const webDockerfileContent = readFileSync(join(testDir, "web", "Dockerfile"), "utf8");
      const composeContent = readFileSync(join(testDir, "docker-compose.yml"), "utf8");

      expect(graphqlPackageJson.dependencies?.["@apollo/server"]).toBe("^4.12.2");
      expect(graphqlPackageJson.dependencies?.["@as-integrations/aws-lambda"]).toBeUndefined();
      expect(graphqlPackageJson.dependencies?.["apollo-server"]).toBeUndefined();
      assertSourceBareImportsDeclared(join(testDir, "apps", "graphql-api"));
      expect(apiDockerfileContent).toContain("turbo prune @test/graphql-api --docker");
      expect(apiDockerfileContent).toContain("pnpm turbo build --filter=@test/graphql-api");
      expect(apiDockerfileContent).toContain('CMD ["node", "apps/graphql-api/dist/index.js"]');
      expect(webDockerfileContent).toContain("turbo prune @test/web --docker");
      expect(webDockerfileContent).toContain("pnpm turbo build --filter=@test/web");
      expect(composeContent).toContain("dockerfile: apps/graphql-api/Dockerfile");
      expect(composeContent).toContain('"4000:4000"');
      expect(existsSync(join(testDir, "apps", "api", "Dockerfile"))).toBe(false);
      assertDockerFiltersMatchPackages(testDir);
      assertNoHandlebarsPlaceholders(testDir);
      assertNoTailwindReferences(testDir);
      assertNoExternalCrocoWorkspaceRanges(testDir);
    },
  );

  it("generates ddd-fullstack with trpc nextjs + vercel", { timeout: 120_000 }, async () => {
    const options: GeneratorOptions = {
      projectName: "my-trpc",
      scope: "@test",
      preset: "ddd-fullstack",
      webApps: ["web"],
      api: "trpc",
      apiHosting: "nextjs",
      frontendDeploy: "vercel",
      db: [],
      agentRules: false,
      installDeps: false,
      initGit: false,
    };

    await generate(testDir, options);

    // tRPC nextjs: Next.js 앱에 tRPC 내장
    expect(existsSync(join(testDir, "apps", "web"))).toBe(true);
    // Vercel config
    expect(existsSync(join(testDir, "apps", "web", "vercel.json"))).toBe(true);
  });

  it(
    "generates ddd-fullstack with Cloudflare Meta Vite declared config imports",
    { timeout: 120_000 },
    async () => {
      const options: GeneratorOptions = {
        projectName: "my-meta-vite",
        scope: "@test",
        preset: "ddd-fullstack",
        webApps: ["web"],
        api: "graphql",
        apiHosting: "standalone",
        frontendDeploy: "cloudflare-meta-vite",
        db: [],
        agentRules: false,
        installDeps: false,
        initGit: false,
      };

      await generate(testDir, options);

      const webDir = join(testDir, "apps", "web");
      const packageJson = readPackageJson(join(webDir, "package.json"));

      expect(packageJson.dependencies?.["@croco/meta-vite"]).toBe("^0.0.2");
      expect(packageJson.scripts?.["presentation:smoke"]).toBe(
        "tsx src/smoke/presentationSmoke.ts",
      );
      expect(packageJson.devDependencies?.tsx).toBe("^4.20.3");
      expect(existsSync(join(webDir, "src", "smoke", "presentationSmoke.ts"))).toBe(true);
      assertViteConfigImportsDeclared(webDir);
      assertSourceBareImportsDeclared(webDir);
      assertNoHandlebarsPlaceholders(testDir);
      assertNoExternalCrocoWorkspaceRanges(testDir);
    },
  );

  it(
    "generates ddd-vike-fullstack with worker security validation opt-out",
    { timeout: 120_000 },
    async () => {
      const options: GeneratorOptions = {
        projectName: "my-vike-fullstack",
        scope: "@test",
        preset: "ddd-vike-fullstack",
        webApps: ["web"],
        frontendDeploy: "cloudflare-meta-vite",
        apiHosting: "standalone",
        db: [],
        agentRules: false,
        installDeps: false,
        initGit: false,
      };

      await generate(testDir, options);

      const workerContent = readFileSync(join(testDir, "api-worker", "src", "index.ts"), "utf8");
      const ssrWorkerDir = join(testDir, "ssr-worker");
      const ssrWorkerPackageJson = readPackageJson(join(ssrWorkerDir, "package.json"));

      expect(workerContent).toContain('securityValidation: "off"');
      expect(ssrWorkerPackageJson.dependencies?.["@croco/meta-vite"]).toBe("^0.0.2");
      expect(ssrWorkerPackageJson.scripts?.["presentation:smoke"]).toBe(
        "tsx src/smoke/presentationSmoke.ts",
      );
      expect(ssrWorkerPackageJson.devDependencies?.tsx).toBe("^4.20.3");
      expect(existsSync(join(ssrWorkerDir, "src", "smoke", "presentationSmoke.ts"))).toBe(true);
      assertViteConfigImportsDeclared(ssrWorkerDir);
      assertSourceBareImportsDeclared(ssrWorkerDir);
      assertNoHandlebarsPlaceholders(testDir);
      assertNoExternalCrocoWorkspaceRanges(testDir);
    },
  );

  it("generates ddd-api with graphql + lambda + mongodb", { timeout: 120_000 }, async () => {
    const options: GeneratorOptions = {
      projectName: "my-api",
      scope: "@test",
      preset: "ddd-api",
      webApps: [],
      api: "graphql",
      apiHosting: "standalone",
      backendDeploy: "lambda",
      db: ["mongodb"],
      agentRules: false,
      installDeps: false,
      initGit: false,
    };

    await generate(testDir, options);

    // GraphQL API
    expect(existsSync(join(testDir, "apps", "graphql-api"))).toBe(true);
    const handlerContent = readFileSync(
      join(testDir, "apps", "graphql-api", "src", "handler.ts"),
      "utf8",
    );
    const schemaContent = readFileSync(
      join(testDir, "apps", "graphql-api", "src", "schema.ts"),
      "utf8",
    );
    const packageJson = readPackageJson(join(testDir, "apps", "graphql-api", "package.json"));

    expect(handlerContent).toContain('from "@croco/telemetry-sdk-node";');
    expect(handlerContent).toContain('from "@apollo/server";');
    expect(handlerContent).toContain('from "@as-integrations/aws-lambda";');
    expect(handlerContent).toContain('import { createSchema } from "./schema.js";');
    expect(handlerContent).toContain("const telemetryReady = telemetry.init(");
    expect(handlerContent).toContain("await telemetryReady;");
    expect(handlerContent).toContain("const lambdaHandler = await lambdaHandlerPromise;");
    expect(handlerContent).toContain("await telemetry.forceFlush();");
    expect(schemaContent).toContain("export async function createSchema()");
    expect(packageJson.dependencies?.["@apollo/server"]).toBe("^4.12.2");
    expect(packageJson.dependencies?.["@as-integrations/aws-lambda"]).toBe("^3.1.0");
    expect(packageJson.dependencies?.["apollo-server"]).toBeUndefined();
    expect(packageJson.dependencies?.["@croco/telemetry-sdk-node"]).toBe("^0.0.2");
    expect(packageJson.dependencies?.["@test/provider-database"]).toBe("workspace:*");
    assertSourceBareImportsDeclared(join(testDir, "apps", "graphql-api"));
    assertNoExternalCrocoWorkspaceRanges(testDir);

    // Lambda SST
    expect(existsSync(join(testDir, "sst.config.ts"))).toBe(true);
    assertLambdaHandlerTarget(testDir, "apps/graphql-api/src/handler.handler");
    // MongoDB provider
    expect(existsSync(join(testDir, "libs", "shared", "provider-mongodb"))).toBe(true);
    expect(existsSync(join(testDir, "libs", "shared", "utils-env", "tsconfig.json"))).toBe(true);
    expect(existsSync(join(testDir, "libs", "shared", "provider-mongodb", "tsconfig.json"))).toBe(
      true,
    );
  });

  it("generates ddd-api with trpc + lambda handler target", { timeout: 120_000 }, async () => {
    const options: GeneratorOptions = {
      projectName: "my-trpc-api",
      scope: "@test",
      preset: "ddd-api",
      webApps: [],
      api: "trpc",
      apiHosting: "standalone",
      backendDeploy: "lambda",
      db: [],
      agentRules: false,
      installDeps: false,
      initGit: false,
    };

    await generate(testDir, options);

    expect(existsSync(join(testDir, "sst.config.ts"))).toBe(true);
    assertLambdaHandlerTarget(testDir, "apps/api/src/handler.handler");
  });

  it(
    "generates production app starter with operational defaults",
    { timeout: 120_000 },
    async () => {
      const options: GeneratorOptions = {
        projectName: "my-production-app",
        scope: "@test",
        preset: "production-app",
        webApps: [],
        apiHosting: "standalone",
        db: [],
        agentRules: false,
        installDeps: false,
        initGit: false,
      };

      await generate(testDir, options);

      const rootPackageJson = readPackageJson(join(testDir, "package.json"));
      const apiPackageJson = readPackageJson(join(testDir, "apps", "api-server", "package.json"));
      const readme = readFileSync(join(testDir, "README.md"), "utf8");
      const apiUsersSource = readFileSync(
        join(testDir, "apps", "api-server", "src", "users.ts"),
        "utf8",
      );
      const apiAppSource = readFileSync(
        join(testDir, "apps", "api-server", "src", "app.ts"),
        "utf8",
      );
      const clientSource = readFileSync(
        join(testDir, "apps", "console-web", "src", "api", "client.ts"),
        "utf8",
      );

      expect(rootPackageJson.scripts).toMatchObject({
        dev: "turbo dev",
        "dev:smoke":
          "pnpm --filter @test/api-server dev:smoke && pnpm --filter @test/console-web dev:smoke",
        lint: "biome lint .",
        test: "turbo test",
        typecheck: "turbo typecheck",
      });
      expect(apiPackageJson.scripts).toMatchObject({
        "dev:smoke": "tsx src/dev-smoke.ts",
        build: "tsup src/index.ts src/lambda.ts --format cjs --clean",
        test: "vitest run",
      });
      expect(apiPackageJson.dependencies).toMatchObject({
        "@croco/events-core": "^0.0.2",
        "@croco/events-inmemory": "^0.0.3",
        "@croco/problems-core": "^0.0.2",
        "@croco/protocols-rest": "^0.0.2",
        "@croco/repository-core": "^0.0.2",
        "@croco/retry-core": "^0.0.3",
        "@croco/telemetry-api": "^0.0.2",
        "@croco/telemetry-sdk-node": "^0.0.2",
        "@croco/transports-http": "^0.0.2",
      });
      expect(existsSync(join(testDir, "apps", "api-server", "src", "lambda.ts"))).toBe(true);
      expect(existsSync(join(testDir, "apps", "api-server", "src", "env.ts"))).toBe(true);
      expect(existsSync(join(testDir, "apps", "api-server", "src", "problems.ts"))).toBe(true);
      expect(existsSync(join(testDir, "apps", "api-server", "src", "dev-smoke.ts"))).toBe(true);
      expect(existsSync(join(testDir, "sst.config.ts"))).toBe(true);
      assertLambdaHandlerTarget(testDir, "apps/api-server/src/lambda.handler");
      expect(apiUsersSource).toContain("RetryTemplate");
      expect(apiUsersSource).toContain("EventPublisher");
      expect(apiUsersSource).toContain("InMemoryEventBus");
      expect(apiUsersSource).toContain("Repository");
      expect(apiAppSource).toContain("HttpExceptionFilter");
      expect(apiAppSource).toContain("globalFilters: [HttpExceptionFilter]");
      expect(clientSource).toContain("ApiProblemError");
      expect(readme).toContain("운영형 앱 스타터");
      expect(readme).toContain("비범위");
      expect(readme).toContain("HttpExceptionFilter");
      expect(readme).toContain("TelemetryRuntime.forceFlush");
      assertNoHandlebarsPlaceholders(testDir);
      assertNoExternalCrocoWorkspaceRanges(testDir);
      assertAllSourceBareImportsDeclared(testDir);
    },
  );

  it(
    "generates admin console preset with generated-client workflow",
    { timeout: 120_000 },
    async () => {
      const options: GeneratorOptions = {
        projectName: "my-admin-console",
        scope: "@test",
        preset: "admin-console",
        webApps: [],
        apiHosting: "standalone",
        db: [],
        agentRules: false,
        installDeps: false,
        initGit: false,
      };

      await generate(testDir, options);

      const rootPackageJson = readPackageJson(join(testDir, "package.json"));
      const apiPackageJson = readPackageJson(join(testDir, "apps", "api-server", "package.json"));
      const readme = readFileSync(join(testDir, "README.md"), "utf8");
      const appSource = readFileSync(join(testDir, "apps", "api-server", "src", "app.ts"), "utf8");
      const webSource = readFileSync(
        join(testDir, "apps", "console-web", "src", "App.tsx"),
        "utf8",
      );
      const viteConfig = readFileSync(
        join(testDir, "apps", "console-web", "vite.config.ts"),
        "utf8",
      );

      expect(rootPackageJson.scripts).toMatchObject({
        "admin:smoke":
          "pnpm contract:client && pnpm --filter @test/api-server admin:smoke && pnpm --filter @test/console-web admin:smoke",
        typecheck: "pnpm contract:client && turbo typecheck",
        build: "pnpm contract:client && turbo build",
        "contract:client": expect.stringContaining(
          "apps/api-server/src/{controllers/**/*.ts,admin.ts,users.ts,problems.ts}",
        ),
      });
      expect(apiPackageJson.scripts).toMatchObject({
        "admin:smoke": "tsx src/dev-smoke.ts",
      });
      expect(appSource).toContain("AdminController");
      expect(viteConfig).toContain("'/admin': 'http://localhost:3000'");
      expect(webSource).toContain("import { adminClient, type adminRpc }");
      expect(webSource).toContain("adminClient");
      expect(webSource).toContain("adminRpc.ListUsersOutput");
      expect(webSource).toContain("query: { tenantId: selectedTenantId }");
      expect(webSource).toContain("admin-console/invite-failed");
      expect(webSource).toContain("Probe Missing User");
      expect(webSource).toContain("Operations");
      expect(existsSync(join(testDir, "apps", "api-server", "src", "admin.ts"))).toBe(true);
      expect(
        existsSync(join(testDir, "apps", "api-server", "src", "controllers", "AdminController.ts")),
      ).toBe(true);
      expect(
        existsSync(join(testDir, "apps", "api-server", "src", "tests", "AdminConsole.spec.ts")),
      ).toBe(true);
      expect(readme).toContain("Croco admin console starter");
      expect(readme).toContain("Recovery States");
      expect(readme).toContain("not a marketing landing page");
      assertNoHandlebarsPlaceholders(testDir);
      assertNoExternalCrocoWorkspaceRanges(testDir);
      assertAllSourceBareImportsDeclared(testDir);
    },
  );

  it("generates SaaS preset with runnable demo smoke commands", { timeout: 120_000 }, async () => {
    const options: GeneratorOptions = {
      projectName: "my-saas",
      scope: "@test",
      preset: "saas",
      saasProviderProfile: "saas-cloudflare",
      webApps: [],
      apiHosting: "standalone",
      db: [],
      agentRules: false,
      installDeps: false,
      initGit: false,
    };

    await generate(testDir, options);

    const rootPackageJson = readPackageJson(join(testDir, "package.json"));
    const apiPackageJson = readPackageJson(join(testDir, "apps", "api-server", "package.json"));

    expect(rootPackageJson.scripts).toMatchObject({
      typecheck: "turbo typecheck",
      build: "turbo build",
      test: "turbo test",
      "demo:seed": "pnpm --filter @test/api-server demo:seed",
      "profile:check": "pnpm --filter @test/api-server profile:check",
      "profile:smoke:real": "pnpm --filter @test/api-server profile:smoke:real",
      "demo:smoke":
        "pnpm profile:check && pnpm contract:check && pnpm --filter @test/api-server demo:smoke && pnpm --filter @test/api-server ops:smoke",
      "ops:smoke": "pnpm --filter @test/api-server ops:smoke",
    });
    expect(apiPackageJson.dependencies).toMatchObject({
      "@croco/tenant-core": "^0.0.2",
      "@croco/auth-core": "^0.0.2",
      "@croco/access-core": "^0.0.2",
      "@croco/billing-core": "^0.0.2",
      "@croco/metering-core": "^0.0.2",
      "@croco/entitlements-core": "^0.0.2",
      "@croco/execution-core": "^0.0.2",
      "@croco/health-core": "^0.0.2",
      "@croco/framework-context": "^0.0.2",
      "@croco/diagnostics-core": "^0.0.2",
      "@croco/llm-core": "^0.0.2",
      "@croco/llm-metering": "^0.0.2",
      "@croco/problems-core": "^0.0.2",
      "@croco/ratelimit-core": "^0.0.2",
      "@croco/telemetry-api": "^0.0.2",
      "@croco/telemetry-sdk-node": "^0.0.2",
    });
    expect(apiPackageJson.scripts).toMatchObject({
      "profile:check": "tsx src/provider-profile-check.ts --mode=manifest",
      "profile:smoke:real": "tsx src/provider-profile-check.ts --mode=real-provider",
    });
    expect(apiPackageJson.devDependencies?.typedi).toBe("^0.10.0");
    expect(apiPackageJson.devDependencies?.["@croco/cli"]).toBe("^0.0.3");
    expect(apiPackageJson.scripts?.["ops:smoke"]).toBe("tsx src/demo/ops-smoke.ts");
    expect(existsSync(join(testDir, "apps", "api-server", "src", "saasDemo.ts"))).toBe(true);
    expect(existsSync(join(testDir, "apps", "api-server", "src", "providerProfiles.ts"))).toBe(
      true,
    );
    expect(
      existsSync(join(testDir, "apps", "api-server", "src", "provider-profile-check.ts")),
    ).toBe(true);
    expect(
      existsSync(join(testDir, "apps", "api-server", "src", "generatedSaasProviderProfile.ts")),
    ).toBe(true);
    expect(existsSync(join(testDir, "croco-saas-profile.manifest.json"))).toBe(true);
    expect(existsSync(join(testDir, ".env.example"))).toBe(true);
    expect(existsSync(join(testDir, "docs", "provider-profile.md"))).toBe(true);
    expect(existsSync(join(testDir, "docs", "secrets-checklist.md"))).toBe(true);
    const profileManifest = JSON.parse(
      readFileSync(join(testDir, "croco-saas-profile.manifest.json"), "utf8"),
    );
    const envExample = readFileSync(join(testDir, ".env.example"), "utf8");
    const providerProfileDocs = readFileSync(join(testDir, "docs", "provider-profile.md"), "utf8");
    const generatedProfileSource = readFileSync(
      join(testDir, "apps", "api-server", "src", "generatedSaasProviderProfile.ts"),
      "utf8",
    );

    expect(profileManifest).toMatchObject({
      schemaVersion: "croco.saas-provider-profile/v1",
      profile: {
        name: "saas-cloudflare",
        runtimeTarget: "cloudflare-workers",
      },
      smoke: {
        zeroCredential: "pnpm demo:smoke",
        realProviderOptIn: "SAAS_PROVIDER_PROFILE=saas-cloudflare pnpm profile:smoke:real",
      },
    });
    expect(profileManifest.packages).toEqual(
      expect.arrayContaining([
        "@croco/transports-cloudflare-workers",
        "@croco/auth-clerk",
        "@croco/billing-polar",
        "@croco/metering-upstash",
        "@croco/storage-r2",
        "@croco/tasks-qstash",
      ]),
    );
    for (const packageName of profileManifest.packages as string[]) {
      expect(apiPackageJson.dependencies?.[packageName], packageName).toEqual(expect.any(String));
    }
    expect(apiPackageJson.dependencies).toMatchObject({
      "@croco/preset-cloudflare": "^0.0.2",
      "@croco/auth-clerk": "^0.0.2",
      "@croco/billing-polar": "^0.0.2",
      "@croco/metering-upstash": "^0.0.2",
      "@croco/storage-r2": "^0.0.2",
      "@croco/tasks-qstash": "^0.0.2",
      "@croco/triggers-qstash": "^0.0.2",
      "@clerk/backend": "^1.0.0",
      "@polar-sh/sdk": "^0.32.2",
      "@upstash/qstash": "^2.9.0",
      "@upstash/redis": "^1.34.0",
    });
    expect(profileManifest.compatibility.requiredCapabilities).toEqual([
      "runtime",
      "auth",
      "billing",
      "metering",
      "storage",
      "tasks",
      "telemetry",
      "webhookVerification",
    ]);
    expect(envExample).toContain("SAAS_PROVIDER_PROFILE=saas-cloudflare");
    expect(envExample).toContain("CLOUDFLARE_ACCOUNT_ID=<secret>");
    expect(providerProfileDocs).toContain("Capability Matrix");
    expect(providerProfileDocs).toContain("QStash");
    expect(generatedProfileSource).toContain("saas-cloudflare");
    expect(
      existsSync(join(testDir, "apps", "api-server", "src", "demo", "saasSmokeContract.ts")),
    ).toBe(true);
    expect(existsSync(join(testDir, "apps", "api-server", "src", "demo", "ops-smoke.ts"))).toBe(
      true,
    );
    expect(
      existsSync(join(testDir, "apps", "api-server", "src", "controllers", "SaasController.ts")),
    ).toBe(true);
    expect(
      existsSync(
        join(testDir, "apps", "api-server", "src", "controllers", "OperationsController.ts"),
      ),
    ).toBe(true);
    expect(
      existsSync(join(testDir, "apps", "api-server", "src", "controllers", "JobsController.ts")),
    ).toBe(true);
    expect(
      existsSync(join(testDir, "apps", "api-server", "src", "tests", "SaasDemo.spec.ts")),
    ).toBe(true);
    expect(existsSync(join(testDir, "libs", "shared", "provider-rpc"))).toBe(true);
    assertNoHandlebarsPlaceholders(testDir);
    assertNoExternalCrocoWorkspaceRanges(testDir);
    assertAllSourceBareImportsDeclared(testDir);
  });

  it(
    "generates a goal-first SaaS API app with manifest evidence",
    { timeout: 120_000 },
    async () => {
      const options = normalizeNonInteractiveOptions(
        parseCliOptions("my-saas-api", {
          goal: "saas-api",
          scope: "@test",
          install: false,
          git: false,
          agentRules: false,
        }),
      );

      await generate(testDir, options);

      const rootPackageJson = readPackageJson(join(testDir, "package.json"));
      const manifest = JSON.parse(readFileSync(join(testDir, "croco.app.json"), "utf8")) as {
        schemaVersion?: unknown;
        projectName?: unknown;
        scope?: unknown;
        goal?: unknown;
        preset?: unknown;
        runtimeTarget?: unknown;
        protocol?: unknown;
        providers?: unknown;
        storage?: unknown;
        auth?: unknown;
        billing?: unknown;
        telemetry?: unknown;
        deploymentPreset?: unknown;
        qualityGates?: unknown;
      };

      expect(rootPackageJson.scripts).toMatchObject({
        typecheck: "turbo typecheck",
        build: "turbo build",
        test: "turbo test",
        "contract:verify":
          "pnpm contract:diff && pnpm contract:coverage && pnpm contract:openapi && pnpm contract:client && pnpm --filter @test/provider-rpc typecheck",
        "demo:smoke":
          "pnpm profile:check && pnpm contract:check && pnpm --filter @test/api-server demo:smoke && pnpm --filter @test/api-server ops:smoke",
      });
      expect(manifest).toMatchObject({
        schemaVersion: 1,
        projectName: "my-saas-api",
        scope: "@test",
        goal: "saas-api",
        preset: "saas",
        runtimeTarget: "node",
        protocol: "rest",
        providers: [
          "in-memory-tenant",
          "in-memory-auth",
          "in-memory-billing",
          "in-memory-metering",
          "in-memory-events",
        ],
        storage: ["in-memory-demo"],
        auth: "tenant-demo",
        billing: "demo",
        telemetry: "opentelemetry-otlp",
        deploymentPreset: "node-api",
        qualityGates: ["install", "typecheck", "build", "test", "contract:verify", "demo:smoke"],
      });
      assertNoHandlebarsPlaceholders(testDir);
      assertNoExternalCrocoWorkspaceRanges(testDir);
      assertAllSourceBareImportsDeclared(testDir);
    },
  );

  it(
    "generates AI SaaS preset with tenant-metered AI smoke commands",
    { timeout: 120_000 },
    async () => {
      const options: GeneratorOptions = {
        projectName: "my-ai-saas",
        scope: "@test",
        preset: "ai-saas",
        webApps: [],
        apiHosting: "standalone",
        db: [],
        agentRules: false,
        installDeps: false,
        initGit: false,
      };

      await generate(testDir, options);

      const rootPackageJson = readPackageJson(join(testDir, "package.json"));
      const apiPackageJson = readPackageJson(join(testDir, "apps", "api-server", "package.json"));
      const appSource = readFileSync(join(testDir, "apps", "api-server", "src", "app.ts"), "utf8");

      expect(rootPackageJson.scripts).toMatchObject({
        "ai:smoke": "pnpm --filter @test/api-server ai:smoke",
        "demo:smoke":
          "pnpm contract:check && pnpm --filter @test/api-server demo:smoke && pnpm --filter @test/api-server ops:smoke && pnpm --filter @test/api-server ai:smoke",
      });
      expect(apiPackageJson.dependencies).toMatchObject({
        "@croco/llm-core": "^0.0.2",
        "@croco/llm-metering": "^0.0.2",
        "@croco/framework-context": "^0.0.2",
        "@croco/lifecycle-core": "^0.0.1",
        "@croco/metering-core": "^0.0.2",
        "@croco/protocols-rest": "^0.0.2",
        "@croco/telemetry-api": "^0.0.2",
        "@croco/tenant-core": "^0.0.2",
      });
      expect(apiPackageJson.scripts?.["ai:smoke"]).toBe("tsx src/demo/ai-smoke.ts");
      expect(appSource).toMatch(/AiController/);
      expect(appSource).toMatch(
        /\[OperationsController, JobsController, SaasController, AiController\]/,
      );
      expect(existsSync(join(testDir, "README.md"))).toBe(true);
      expect(existsSync(join(testDir, "apps", "api-server", "src", "aiSaas.ts"))).toBe(true);
      expect(existsSync(join(testDir, "apps", "api-server", "src", "aiProblems.ts"))).toBe(true);
      expect(
        existsSync(join(testDir, "apps", "api-server", "src", "controllers", "AiController.ts")),
      ).toBe(true);
      expect(
        existsSync(join(testDir, "apps", "api-server", "src", "controllers", "aiSchemas.ts")),
      ).toBe(true);
      expect(
        existsSync(join(testDir, "apps", "api-server", "src", "demo", "aiSmokeContract.ts")),
      ).toBe(true);
      expect(existsSync(join(testDir, "apps", "api-server", "src", "demo", "ai-smoke.ts"))).toBe(
        true,
      );
      expect(
        existsSync(join(testDir, "apps", "api-server", "src", "tests", "AiSaas.spec.ts")),
      ).toBe(true);
      assertNoHandlebarsPlaceholders(testDir);
      assertNoExternalCrocoWorkspaceRanges(testDir);
      assertAllSourceBareImportsDeclared(testDir);
    },
  );

  it(
    "preserves generated workspace dependencies when the app scope is @croco",
    { timeout: 120_000 },
    async () => {
      const options: GeneratorOptions = {
        projectName: "croco-scoped-api",
        scope: "@croco",
        preset: "ddd-api",
        webApps: [],
        api: "graphql",
        apiHosting: "standalone",
        db: [],
        agentRules: false,
        installDeps: false,
        initGit: false,
      };

      await generate(testDir, options);

      const packageJson = readPackageJson(join(testDir, "apps", "graphql-api", "package.json"));

      expect(packageJson.dependencies?.["@croco/telemetry-sdk-node"]).toBe("^0.0.2");
      expect(packageJson.dependencies?.["@croco/provider-database"]).toBe("workspace:*");
      assertNoExternalCrocoWorkspaceRanges(testDir);
    },
  );
});
