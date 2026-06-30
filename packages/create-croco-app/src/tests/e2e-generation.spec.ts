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
  /\b(?:import|export)\s+(type\s+)?(?:[^'"]*?\s+from\s+)?["']([^"']+)["']/g;
const DYNAMIC_IMPORT_SPECIFIER_PATTERN = /\bimport\(\s*["']([^"']+)["']\s*\)/g;

type DependencyField = (typeof DEPENDENCY_FIELDS)[number];
type ImportReference = {
  specifier: string;
  typeOnly: boolean;
};
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

function toTypesPackageName(packageName: string): string {
  if (!packageName.startsWith("@")) {
    return `@types/${packageName}`;
  }

  const [scope, name] = packageName.split("/");

  return `@types/${scope.slice(1)}__${name}`;
}

function collectBarePackageImports(filePath: string): string[] {
  const imports = preProcessFile(readFileSync(filePath, "utf8"), true, true)
    .importedFiles.map(({ fileName }) => toPackageName(fileName))
    .filter((packageName): packageName is string => packageName !== undefined);

  return [...new Set(imports)];
}

function collectImportReferences(content: string): ImportReference[] {
  return [
    ...[...content.matchAll(IMPORT_SPECIFIER_PATTERN)].map((match) => ({
      specifier: match[2],
      typeOnly: match[1] !== undefined,
    })),
    ...[...content.matchAll(DYNAMIC_IMPORT_SPECIFIER_PATTERN)].map((match) => ({
      specifier: match[1],
      typeOnly: false,
    })),
  ];
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
      collectImportReferences(readFileSync(filePath, "utf8")).flatMap((reference) => {
        const packageName = toPackageName(reference.specifier);

        if (packageName === undefined) {
          return [];
        }

        if (
          declaredDependencies.has(packageName) ||
          (reference.typeOnly && declaredDependencies.has(toTypesPackageName(packageName)))
        ) {
          return [];
        }

        return [
          {
            filePath: relative(packageDir, filePath),
            packageName,
          },
        ];
      }),
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

function assertMetaViteBrowserBuildEntrypoint(packageDir: string, buildScript: string): void {
  const packageJson = readPackageJson(join(packageDir, "package.json"));
  const indexHtml = readFileSync(join(packageDir, "index.html"), "utf8");
  const viteConfig = readFileSync(join(packageDir, "vite.config.ts"), "utf8");

  expect(packageJson.scripts?.build).toBe(buildScript);
  expect(existsSync(join(packageDir, "index.html"))).toBe(true);
  expect(indexHtml).toContain('src="/src/client.tsx"');
  expect(indexHtml).toContain("data-croco-hydration-root");
  expect(existsSync(join(packageDir, "src", "client.tsx"))).toBe(true);
  expect(existsSync(join(packageDir, "src", "main.tsx"))).toBe(false);
  expect(viteConfig).toContain("from '@vitejs/plugin-react'");
  expect(viteConfig).toContain("defineConfig");
  expect(viteConfig).toContain("react()");
  expect(viteConfig).toContain("crocoMetaVitePlugin()");
  expect(viteConfig).toContain("manifest: 'manifest.json'");
  expect(viteConfig).toContain("outDir: 'dist/client'");
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
    const readme = readFileSync(join(testDir, "README.md"), "utf8");
    expect(readme).toContain("Blank Croco workspace");
    expect(readme).toContain("pnpm install");
    expect(readme).toContain("pnpm dev");
    expect(readme).toContain("pnpm typecheck");
    expect(readme).toContain("expected success state");
    expect(readme).toContain("Recovery");
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
      expect(graphqlPackageJson.dependencies?.["@croco/protocols-graphql"]).toBe("^0.0.3");
      expect(graphqlPackageJson.dependencies?.["apollo-server"]).toBeUndefined();
      expect(graphqlPackageJson.scripts?.["contract:check"]).toBe(
        "tsx src/graphql-contract.ts --check",
      );
      expect(graphqlPackageJson.scripts?.["contract:snapshot"]).toBe(
        "tsx src/graphql-contract.ts --write",
      );
      expect(graphqlPackageJson.scripts?.build).toBe(
        "pnpm contract:check && tsup src/index.ts --format cjs --clean",
      );
      expect(graphqlPackageJson.scripts?.typecheck).toBe("pnpm contract:check && tsc --noEmit");
      expect(
        existsSync(join(testDir, "apps", "graphql-api", "graphql-contract.snapshot.json")),
      ).toBe(true);
      expect(existsSync(join(testDir, "apps", "graphql-api", "src", "graphql-contract.ts"))).toBe(
        true,
      );
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
      expect(packageJson.dependencies?.["@croco/problems-core"]).toBe("^0.0.2");
      expect(packageJson.scripts?.build).toBe("vite build --outDir dist/client");
      expect(packageJson.scripts?.preview).toBe("vite preview --outDir dist/client");
      expect(packageJson.scripts?.["presentation:smoke"]).toBe(
        "tsx src/smoke/presentationSmoke.ts",
      );
      expect(packageJson.devDependencies?.["happy-dom"]).toBe("^20.10.6");
      expect(packageJson.devDependencies?.tsx).toBe("^4.20.3");
      expect(existsSync(join(webDir, "src", "smoke", "presentationSmoke.ts"))).toBe(true);
      assertMetaViteBrowserBuildEntrypoint(webDir, "vite build --outDir dist/client");
      assertViteConfigImportsDeclared(webDir);
      assertSourceBareImportsDeclared(webDir);
      assertNoHandlebarsPlaceholders(testDir);
      assertNoExternalCrocoWorkspaceRanges(testDir);
    },
  );

  it(
    "generates ddd-vike-fullstack with secure worker bootstrap middleware",
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
      const workerPackageJson = readPackageJson(join(testDir, "api-worker", "package.json"));
      const workspaceConfig = readFileSync(join(testDir, "pnpm-workspace.yaml"), "utf8");
      const workerWranglerConfig = readFileSync(
        join(testDir, "api-worker", "wrangler.toml"),
        "utf8",
      );
      const ssrWorkerDir = join(testDir, "ssr-worker");
      const ssrWorkerPackageJson = readPackageJson(join(ssrWorkerDir, "package.json"));

      expect(workerContent).not.toContain('securityValidation: "off"');
      expect(workerContent).toContain("securityHeadersMiddleware()");
      expect(workerContent).toContain("WEB_ORIGIN?: string");
      expect(workerContent).toContain("corsMiddleware({ origins: [webOrigin] })");
      expect(workerContent).toContain("bodyLimitMiddleware({ limit: mb(1) })");
      expect(workerContent).toContain("rateLimitHttpMiddleware({");
      expect(workerContent).toMatch(
        /new Set\(\[\s*"\/health",\s*"\/health\/live",\s*"\/health\/ready",\s*"\/ready",?\s*\]\)/,
      );
      expect(workerContent).toContain(
        "skip: (ctx) => OPERATIONAL_RATE_LIMIT_BYPASS_PATHS.has(ctx.req.path)",
      );
      expect(workerPackageJson.dependencies?.["@croco/ratelimit-core"]).toBe("^0.0.2");
      expect(workspaceConfig).toContain("onlyBuiltDependencies:");
      expect(workspaceConfig).toContain("- workerd");
      expect(workerWranglerConfig).not.toMatch(/^\s*\[build\]\s*$/m);
      expect(ssrWorkerPackageJson.dependencies?.["@croco/meta-vite"]).toBe("^0.0.2");
      expect(ssrWorkerPackageJson.dependencies?.["@croco/problems-core"]).toBe("^0.0.2");
      expect(ssrWorkerPackageJson.scripts?.build).toBe(
        "vite build --outDir dist/client && vite build --ssr src/index.ts --outDir dist --emptyOutDir false",
      );
      expect(ssrWorkerPackageJson.scripts?.preview).toBe("vite preview --outDir dist/client");
      expect(ssrWorkerPackageJson.scripts?.["presentation:smoke"]).toBe(
        "tsx src/smoke/presentationSmoke.ts",
      );
      expect(ssrWorkerPackageJson.devDependencies?.["happy-dom"]).toBe("^20.10.6");
      expect(ssrWorkerPackageJson.devDependencies?.tsx).toBe("^4.20.3");
      expect(existsSync(join(ssrWorkerDir, "src", "smoke", "presentationSmoke.ts"))).toBe(true);
      assertMetaViteBrowserBuildEntrypoint(
        ssrWorkerDir,
        "vite build --outDir dist/client && vite build --ssr src/index.ts --outDir dist --emptyOutDir false",
      );
      assertSourceBareImportsDeclared(join(testDir, "api-worker"));
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
    expect(handlerContent).toContain('import type { APIGatewayProxyHandlerV2 } from "aws-lambda";');
    expect(handlerContent).toContain('import { createSchema } from "./schema.js";');
    expect(handlerContent).toContain("const telemetryReady = telemetry.init(");
    expect(handlerContent).toContain(
      "const lambdaHandlerPromise: Promise<APIGatewayProxyHandlerV2>",
    );
    expect(handlerContent).toContain("await telemetryReady;");
    expect(handlerContent).toContain("const lambdaHandler = await lambdaHandlerPromise;");
    expect(handlerContent).toContain("await telemetry.forceFlush();");
    expect(schemaContent).toContain("export async function createSchema()");
    expect(packageJson.dependencies?.["@apollo/server"]).toBe("^4.12.2");
    expect(packageJson.dependencies?.["@as-integrations/aws-lambda"]).toBe("^3.1.0");
    expect(packageJson.devDependencies?.["@types/aws-lambda"]).toBe("^8.10.146");
    expect(packageJson.dependencies?.["apollo-server"]).toBeUndefined();
    expect(packageJson.dependencies?.["@croco/protocols-graphql"]).toBe("^0.0.3");
    expect(packageJson.dependencies?.["@croco/telemetry-sdk-node"]).toBe("^0.0.2");
    expect(packageJson.dependencies?.["@test/provider-database"]).toBe("workspace:*");
    expect(packageJson.scripts?.["contract:check"]).toBe("tsx src/graphql-contract.ts --check");
    expect(packageJson.scripts?.["contract:snapshot"]).toBe("tsx src/graphql-contract.ts --write");
    expect(packageJson.scripts?.build).toBe(
      "pnpm contract:check && tsup src/index.ts --format cjs --clean",
    );
    expect(packageJson.scripts?.typecheck).toBe("pnpm contract:check && tsc --noEmit");
    expect(schemaContent).toContain('from "./resolvers/health.resolver.js";');
    expect(existsSync(join(testDir, "apps", "graphql-api", "graphql-contract.snapshot.json"))).toBe(
      true,
    );
    expect(existsSync(join(testDir, "apps", "graphql-api", "src", "graphql-contract.ts"))).toBe(
      true,
    );
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
      const consolePackageJson = readPackageJson(
        join(testDir, "apps", "console-web", "package.json"),
      );
      const rpcPackageJson = readPackageJson(
        join(testDir, "libs", "shared", "provider-rpc", "package.json"),
      );
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
      expect(rootPackageJson.scripts?.["contract:client"]).toContain(
        "--problem-runtime frontend-problems",
      );
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
      expect(consolePackageJson.dependencies).toMatchObject({
        "@croco/frontend-problems": "^0.1.0",
      });
      expect(rpcPackageJson.dependencies).toMatchObject({
        "@croco/frontend-problems": "^0.1.0",
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
      expect(clientSource).toContain("handleJsonResponse");
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
      expect(rootPackageJson.scripts?.["contract:client"]).toContain(
        "--problem-runtime frontend-problems",
      );
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
      tenantModel: "workspace",
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
    const failureDrillSource = readFileSync(
      join(testDir, "apps", "api-server", "src", "demo", "failure-drill-smoke.ts"),
      "utf8",
    );

    expect(rootPackageJson.scripts).toMatchObject({
      typecheck: "turbo typecheck",
      build: "turbo build",
      test: "turbo test",
      "demo:seed": "pnpm --filter @test/api-server demo:seed",
      "profile:check": "pnpm --filter @test/api-server profile:check",
      "architecture-policy:check":
        "NODE_PATH=./node_modules croco architecture-policy check --manifest croco.arch.json",
      "runtime-policy:check":
        "NODE_PATH=./node_modules croco runtime-policy check --manifest croco-runtime-policy.manifest.json",
      "project-map:write":
        "NODE_PATH=./node_modules croco project map --controllers 'apps/api-server/src/controllers/**/*.ts' --runtime-policy croco-runtime-policy.manifest.json --provider-profile croco-saas-profile.manifest.json --out croco.project-map.json",
      "project-map:check":
        "NODE_PATH=./node_modules croco project map --controllers 'apps/api-server/src/controllers/**/*.ts' --runtime-policy croco-runtime-policy.manifest.json --provider-profile croco-saas-profile.manifest.json --check --manifest croco.project-map.json",
      "profile:smoke:real": "pnpm --filter @test/api-server profile:smoke:real",
      "demo:smoke":
        "pnpm profile:check && pnpm architecture-policy:check && pnpm runtime-policy:check && pnpm contract:check && pnpm --filter @test/api-server demo:smoke && pnpm --filter @test/api-server ops:smoke && pnpm --filter @test/api-server jobs:smoke",
      "ops:smoke": "pnpm --filter @test/api-server ops:smoke",
      "jobs:smoke": "pnpm --filter @test/api-server jobs:smoke",
      "failure-drill:smoke": "pnpm --filter @test/api-server failure-drill:smoke",
      "failure-drill:integration": "pnpm --filter @test/api-server failure-drill:integration",
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
    expect(apiPackageJson.dependencies?.["@croco/testing"]).toBeUndefined();
    expect(apiPackageJson.scripts).toMatchObject({
      "profile:check": "tsx src/provider-profile-check.ts --mode=manifest",
      "profile:smoke:real": "tsx src/provider-profile-check.ts --mode=real-provider",
    });
    expect(apiPackageJson.devDependencies?.typedi).toBe("^0.10.0");
    expect(apiPackageJson.devDependencies?.["@croco/cli"]).toMatch(/^\^[0-9]+\.[0-9]+\.[0-9]+$/);
    expect(apiPackageJson.devDependencies?.["@croco/testing"]).toBe("^0.0.1");
    expect(apiPackageJson.scripts?.["ops:smoke"]).toBe("tsx src/demo/ops-smoke.ts");
    expect(apiPackageJson.scripts?.["jobs:smoke"]).toBe("tsx src/demo/jobs-smoke.ts");
    expect(apiPackageJson.scripts?.["failure-drill:smoke"]).toBe(
      "tsx src/demo/failure-drill-smoke.ts",
    );
    expect(apiPackageJson.scripts?.["failure-drill:integration"]).toBe(
      "tsx src/provider-profile-check.ts --mode=real-provider",
    );
    expect(existsSync(join(testDir, "apps", "api-server", "src", "saasDemo.ts"))).toBe(true);
    expect(existsSync(join(testDir, "apps", "api-server", "src", "providerProfiles.ts"))).toBe(
      true,
    );
    expect(
      existsSync(join(testDir, "apps", "api-server", "src", "provider-profile-check.ts")),
    ).toBe(true);
    expect(failureDrillSource).toContain("assertSaasSmokeContract(snapshot)");
    expect(
      existsSync(join(testDir, "apps", "api-server", "src", "generatedSaasProviderProfile.ts")),
    ).toBe(true);
    expect(existsSync(join(testDir, "apps", "api-server", "src", "generatedTenantModel.ts"))).toBe(
      true,
    );
    expect(existsSync(join(testDir, "croco-saas-profile.manifest.json"))).toBe(true);
    expect(existsSync(join(testDir, "croco-tenant-model.manifest.json"))).toBe(true);
    expect(existsSync(join(testDir, "croco-tenant-model.schema.json"))).toBe(true);
    expect(existsSync(join(testDir, "croco.arch.json"))).toBe(true);
    expect(existsSync(join(testDir, "croco-runtime-policy.manifest.json"))).toBe(true);
    expect(existsSync(join(testDir, "croco-runtime-capability.manifest.json"))).toBe(true);
    expect(existsSync(join(testDir, ".env.example"))).toBe(true);
    expect(existsSync(join(testDir, "docs", "provider-profile.md"))).toBe(true);
    expect(existsSync(join(testDir, "docs", "tenant-model-playbook.md"))).toBe(true);
    expect(existsSync(join(testDir, "docs", "secrets-checklist.md"))).toBe(true);
    const profileManifest = JSON.parse(
      readFileSync(join(testDir, "croco-saas-profile.manifest.json"), "utf8"),
    );
    const tenantModelManifest = JSON.parse(
      readFileSync(join(testDir, "croco-tenant-model.manifest.json"), "utf8"),
    );
    const tenantModelSchema = JSON.parse(
      readFileSync(join(testDir, "croco-tenant-model.schema.json"), "utf8"),
    );
    const runtimePolicyManifest = JSON.parse(
      readFileSync(join(testDir, "croco-runtime-policy.manifest.json"), "utf8"),
    );
    const runtimeCapabilityManifest = JSON.parse(
      readFileSync(join(testDir, "croco-runtime-capability.manifest.json"), "utf8"),
    );
    const architecturePolicyManifest = JSON.parse(
      readFileSync(join(testDir, "croco.arch.json"), "utf8"),
    );
    const envExample = readFileSync(join(testDir, ".env.example"), "utf8");
    const providerProfileDocs = readFileSync(join(testDir, "docs", "provider-profile.md"), "utf8");
    const tenantModelPlaybook = readFileSync(
      join(testDir, "docs", "tenant-model-playbook.md"),
      "utf8",
    );
    const generatedProfileSource = readFileSync(
      join(testDir, "apps", "api-server", "src", "generatedSaasProviderProfile.ts"),
      "utf8",
    );
    const generatedTenantModelSource = readFileSync(
      join(testDir, "apps", "api-server", "src", "generatedTenantModel.ts"),
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
      tenantModel: {
        currentModel: "workspace",
        defaultModel: "org",
        manifest: "croco-tenant-model.manifest.json",
        schema: "croco-tenant-model.schema.json",
        playbook: "docs/tenant-model-playbook.md",
        requiredAdapters: [
          "TenantManager",
          "MembershipManager",
          "InvitationManager",
          "WorkspaceSelectionAdapter",
        ],
      },
    });
    expect(tenantModelManifest).toMatchObject({
      schemaVersion: "croco.tenant-model/v1",
      currentModel: "workspace",
      defaultModel: "org",
      selected: {
        name: "workspace",
        tenantKey: "workspaceId",
      },
      schema: {
        file: "croco-tenant-model.schema.json",
        version: "croco.tenant-model/v1",
      },
      migration: {
        from: "org",
        to: "workspace",
        risk: "low",
      },
    });
    expect(tenantModelManifest.models.map((model: { name: string }) => model.name)).toEqual([
      "single",
      "org",
      "workspace",
      "shared-schema",
      "rls-backed",
    ]);
    expect(tenantModelSchema.properties.currentModel).toEqual({
      enum: ["single", "org", "workspace", "shared-schema", "rls-backed"],
    });
    expect(runtimePolicyManifest).toMatchObject({
      schemaVersion: "croco.runtime-policy/v1",
      runtime: {
        platform: "cloudflare-workers",
        source: {
          file: "croco-saas-profile.manifest.json",
          symbol: "saas-cloudflare",
        },
      },
      table: {
        plans: [],
      },
    });
    expect(runtimeCapabilityManifest).toMatchObject({
      version: "croco.runtime-capability.manifest.v1",
      platform: "cloudflare-workers",
      capabilities: {
        env: true,
        filesystem: false,
        logger: true,
        nodeApi: false,
        requestLifecycle: true,
        trace: true,
        waitUntil: true,
        flush: false,
        streamingResponse: true,
        deadline: false,
        abortSignal: true,
        shutdown: false,
      },
      diagnostics: [],
    });
    expect(architecturePolicyManifest).toMatchObject({
      schemaVersion: "croco.architecture-policy/v1",
      policyName: "my-saas-generated-app",
      packageRoots: ["apps", "libs"],
      rules: {
        allowedGroupImports: expect.arrayContaining([
          expect.objectContaining({
            id: "generated-app-layer-edges",
            allowPackages: ["@test/provider-rpc"],
          }),
        ]),
        publicEntrypoints: expect.objectContaining({
          id: "generated-app-public-entrypoints",
        }),
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
    for (const packageName of [
      ...(profileManifest.packages as string[]),
      ...(profileManifest.tenantModel.requiredPackages as string[]),
    ]) {
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
    expect(providerProfileDocs).toContain("Tenant model: `workspace`");
    expect(providerProfileDocs).toContain("QStash");
    expect(tenantModelPlaybook).toContain("Current model: `workspace`");
    expect(tenantModelPlaybook).toContain("Tenant model migration: org -> workspace");
    expect(tenantModelPlaybook).toContain("tenant-core/tenant-model-runtime-incompatible");
    expect(generatedProfileSource).toContain("saas-cloudflare");
    expect(generatedTenantModelSource).toContain("generatedTenantModelManifest");
    expect(generatedTenantModelSource).toContain('"workspace"');
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

  it("rejects incompatible SaaS provider and tenant model combinations before generation", async () => {
    const options: GeneratorOptions = {
      projectName: "my-incompatible-saas",
      scope: "@test",
      preset: "saas",
      saasProviderProfile: "saas-cloudflare",
      tenantModel: "rls-backed",
      webApps: [],
      apiHosting: "standalone",
      db: [],
      agentRules: false,
      installDeps: false,
      initGit: false,
    };

    await expect(generate(testDir, options)).rejects.toThrow(
      "CROCO_TENANT_MODEL_COMPATIBILITY_FAILED",
    );
    expect(existsSync(join(testDir, "croco-tenant-model.manifest.json"))).toBe(false);
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
        tenantModel?: unknown;
      };
      const tenantModelManifest = JSON.parse(
        readFileSync(join(testDir, "croco-tenant-model.manifest.json"), "utf8"),
      ) as {
        currentModel?: unknown;
        defaultModel?: unknown;
      };
      const runtimeCapabilityManifest = JSON.parse(
        readFileSync(join(testDir, "croco-runtime-capability.manifest.json"), "utf8"),
      ) as {
        version?: unknown;
        platform?: unknown;
        capabilities?: Record<string, unknown>;
        diagnostics?: unknown;
      };

      expect(rootPackageJson.scripts).toMatchObject({
        typecheck: "turbo typecheck",
        build: "turbo build",
        test: "turbo test",
        "contract:verify":
          "pnpm contract:diff && pnpm contract:coverage && pnpm contract:openapi && pnpm contract:client && pnpm --filter @test/provider-rpc typecheck",
        "demo:smoke":
          "pnpm profile:check && pnpm architecture-policy:check && pnpm runtime-policy:check && pnpm contract:check && pnpm --filter @test/api-server demo:smoke && pnpm --filter @test/api-server ops:smoke && pnpm --filter @test/api-server jobs:smoke",
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
        tenantModel: "org",
        telemetry: "opentelemetry-otlp",
        deploymentPreset: "node-api",
        qualityGates: [
          "install",
          "typecheck",
          "build",
          "test",
          "contract:verify",
          "demo:smoke",
          "failure-drill:smoke",
        ],
      });
      expect(tenantModelManifest).toMatchObject({
        currentModel: "org",
        defaultModel: "org",
      });
      expect(runtimeCapabilityManifest).toMatchObject({
        version: "croco.runtime-capability.manifest.v1",
        platform: "node",
        capabilities: {
          env: true,
          filesystem: true,
          logger: true,
          nodeApi: true,
          requestLifecycle: true,
          trace: true,
          waitUntil: false,
          flush: false,
          streamingResponse: true,
          deadline: false,
          abortSignal: true,
          shutdown: false,
        },
        diagnostics: [],
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
      const failureDrillSource = readFileSync(
        join(testDir, "apps", "api-server", "src", "demo", "failure-drill-smoke.ts"),
        "utf8",
      );

      expect(rootPackageJson.scripts).toMatchObject({
        "ai:smoke": "pnpm --filter @test/api-server ai:smoke",
        "demo:smoke":
          "pnpm contract:check && pnpm --filter @test/api-server demo:smoke && pnpm --filter @test/api-server ops:smoke && pnpm --filter @test/api-server ai:smoke",
        "failure-drill:smoke": "pnpm --filter @test/api-server failure-drill:smoke",
        "failure-drill:integration": "pnpm --filter @test/api-server failure-drill:integration",
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
      expect(apiPackageJson.dependencies?.["@croco/testing"]).toBeUndefined();
      expect(apiPackageJson.devDependencies?.["@croco/testing"]).toBe("^0.0.1");
      expect(apiPackageJson.scripts?.["ai:smoke"]).toBe("tsx src/demo/ai-smoke.ts");
      expect(apiPackageJson.scripts?.["failure-drill:smoke"]).toBe(
        "tsx src/demo/failure-drill-smoke.ts",
      );
      expect(failureDrillSource).toContain("assertSaasSmokeContract(snapshot)");
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
      expect(packageJson.dependencies?.["@croco/protocols-graphql"]).toBe("^0.0.3");
      expect(packageJson.dependencies?.["@croco/provider-database"]).toBe("workspace:*");
      assertNoExternalCrocoWorkspaceRanges(testDir);
    },
  );
});
