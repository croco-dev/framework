import { existsSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { basename, join, relative } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { generate } from "../generator.js";
import type { GeneratorOptions } from "../types.js";

const DEPENDENCY_FIELDS = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
] as const;

type DependencyField = (typeof DEPENDENCY_FIELDS)[number];
type PackageJson = {
  name?: string;
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

      // Docker files
      expect(existsSync(join(testDir, "docker-compose.yml"))).toBe(true);
      expect(existsSync(join(testDir, ".dockerignore"))).toBe(true);
      const apiDockerfileContent = readFileSync(
        join(testDir, "apps", "graphql-api", "Dockerfile"),
        "utf8",
      );
      const webDockerfileContent = readFileSync(join(testDir, "web", "Dockerfile"), "utf8");
      const composeContent = readFileSync(join(testDir, "docker-compose.yml"), "utf8");

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

      expect(workerContent).toContain('securityValidation: "off"');
      assertNoHandlebarsPlaceholders(testDir);
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
    expect(handlerContent).toContain('import { createSchema } from "./schema.js";');
    expect(handlerContent).toContain("const telemetryReady = telemetry.init(");
    expect(handlerContent).toContain("await telemetryReady;");
    expect(handlerContent).toContain("const lambdaHandler = await lambdaHandlerPromise;");
    expect(handlerContent).toContain("await telemetry.forceFlush();");
    expect(schemaContent).toContain("export async function createSchema()");
    expect(packageJson.dependencies?.["@croco/telemetry-sdk-node"]).toBe("^0.0.2");
    expect(packageJson.dependencies?.["@test/provider-database"]).toBe("workspace:*");
    assertNoExternalCrocoWorkspaceRanges(testDir);

    // Lambda SST
    expect(existsSync(join(testDir, "sst.config.ts"))).toBe(true);
    assertLambdaHandlerTarget(testDir, "apps/graphql-api/src/handler.handler");
    // MongoDB provider
    expect(existsSync(join(testDir, "libs", "shared", "provider-mongodb"))).toBe(true);
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
