import { existsSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { generate } from "../generator.js";
import { DirectoryNotEmptyProblem } from "../libs/problems/DirectoryNotEmptyProblem.js";
import type { GeneratorOptions } from "../types.js";

const TEXT_FILE_EXTENSIONS = new Set([
  ".css",
  ".js",
  ".json",
  ".md",
  ".ts",
  ".tsx",
  ".yaml",
  ".yml",
]);

type PackageJson = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

function collectFiles(directory: string): string[] {
  return readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name));
}

function readPackageJson(filePath: string): PackageJson {
  return JSON.parse(readFileSync(filePath, "utf8")) as PackageJson;
}

function assertNoTailwindReferences(projectDir: string): void {
  const filesWithTailwindReferences = collectFiles(projectDir)
    .filter((filePath) => TEXT_FILE_EXTENSIONS.has(extname(filePath)))
    .filter((filePath) => readFileSync(filePath, "utf8").toLowerCase().includes("tailwind"))
    .map((filePath) => relative(projectDir, filePath));

  expect(filesWithTailwindReferences).toEqual([]);
}

function assertStylexNextWebApp(webDir: string): void {
  const packageJson = readPackageJson(join(webDir, "package.json"));
  const globalsCss = readFileSync(join(webDir, "src", "app", "globals.css"), "utf8");
  const healthCheckSource = readFileSync(
    join(webDir, "src", "components", "health-check.tsx"),
    "utf8",
  );

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
  expect(healthCheckSource).toContain("@stylexjs/stylex");
  expect(healthCheckSource).toContain("stylex.props");
}

describe("E2E Advanced: generate()", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = `/tmp/croco-e2e-adv-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("generates graphql + nextjs hosting + opennext deploy", { timeout: 120_000 }, async () => {
    const options: GeneratorOptions = {
      projectName: "my-gql-next",
      scope: "@test",
      preset: "ddd-fullstack",
      webApps: ["web"],
      api: "graphql",
      apiHosting: "nextjs",
      frontendDeploy: "opennext",
      db: [],
      agentRules: false,
      installDeps: false,
      initGit: false,
    };

    await generate(testDir, options);

    // GraphQL nextjs: Next.js app with Apollo
    expect(existsSync(join(testDir, "apps", "web"))).toBe(true);
    // OpenNext config
    expect(existsSync(join(testDir, "apps", "web", "open-next.config.ts"))).toBe(true);
  });

  it("generates nextjs Docker frontend deploy file", { timeout: 120_000 }, async () => {
    const options: GeneratorOptions = {
      projectName: "my-docker-web",
      scope: "@test",
      preset: "ddd-fullstack",
      webApps: ["web"],
      api: "trpc",
      apiHosting: "nextjs",
      frontendDeploy: "docker",
      db: [],
      agentRules: false,
      installDeps: false,
      initGit: false,
    };

    await generate(testDir, options);

    const dockerfileContent = readFileSync(join(testDir, "web", "Dockerfile"), "utf8");

    expect(dockerfileContent).toContain("turbo prune @test/web --docker");
    expect(dockerfileContent).toContain("pnpm turbo build --filter=@test/web");
    expect(dockerfileContent).not.toContain("{{scope}}");
  });

  it("generates trpc + multiple webapps + lambda + all DBs", { timeout: 120_000 }, async () => {
    const options: GeneratorOptions = {
      projectName: "my-multi",
      scope: "@test",
      preset: "ddd-fullstack",
      webApps: ["web1", "web2"],
      api: "trpc",
      apiHosting: "standalone",
      backendDeploy: "lambda",
      db: ["postgres", "mongodb", "redis"],
      agentRules: false,
      installDeps: false,
      initGit: false,
    };

    await generate(testDir, options);

    // tRPC standalone API
    expect(existsSync(join(testDir, "apps", "api"))).toBe(true);
    // Multiple web apps
    expect(existsSync(join(testDir, "apps", "web1"))).toBe(true);
    expect(existsSync(join(testDir, "apps", "web2"))).toBe(true);
    assertStylexNextWebApp(join(testDir, "apps", "web1"));
    assertStylexNextWebApp(join(testDir, "apps", "web2"));
    // Lambda
    expect(existsSync(join(testDir, "sst.config.ts"))).toBe(true);
    // All DBs
    expect(existsSync(join(testDir, "libs", "shared", "provider-mongodb"))).toBe(true);
    expect(existsSync(join(testDir, "libs", "shared", "provider-redis"))).toBe(true);
    assertNoTailwindReferences(testDir);
  });

  it("generates graphql + docker + all DBs + agent-rules", { timeout: 120_000 }, async () => {
    const options: GeneratorOptions = {
      projectName: "my-full",
      scope: "@test",
      preset: "ddd-fullstack",
      webApps: ["web"],
      api: "graphql",
      apiHosting: "standalone",
      backendDeploy: "docker",
      db: ["postgres", "mongodb", "redis"],
      agentRules: true,
      installDeps: false,
      initGit: false,
    };

    await generate(testDir, options);

    expect(existsSync(join(testDir, ".agent", "rules"))).toBe(true);
    expect(existsSync(join(testDir, "AGENTS.md"))).toBe(true);
    expect(existsSync(join(testDir, "docker-compose.yml"))).toBe(true);
    expect(existsSync(join(testDir, "libs", "shared", "provider-mongodb"))).toBe(true);
    expect(existsSync(join(testDir, "libs", "shared", "provider-redis"))).toBe(true);
  });

  it("generates ddd-api with no DBs and no agent-rules", { timeout: 120_000 }, async () => {
    const options: GeneratorOptions = {
      projectName: "my-clean-api",
      scope: "@test",
      preset: "ddd-api",
      webApps: [],
      api: "trpc",
      apiHosting: "standalone",
      db: [],
      agentRules: false,
      installDeps: false,
      initGit: false,
    };

    await generate(testDir, options);

    expect(existsSync(join(testDir, "apps", "api"))).toBe(true);
    expect(existsSync(join(testDir, ".agent"))).toBe(false);
    expect(existsSync(join(testDir, "libs", "shared", "provider-mongodb"))).toBe(false);
    const readme = readFileSync(join(testDir, "README.md"), "utf8");
    expect(readme).toContain("Croco DDD workspace");
    expect(readme).toContain("ddd-api");
    expect(readme).toContain("pnpm install");
    expect(readme).toContain("pnpm dev");
    expect(readme).toContain("pnpm build");
    expect(readme).toContain("expected success state");
    expect(readme).toContain("Recovery");
  });

  it("throws error for non-empty directory", { timeout: 120_000 }, async () => {
    const options: GeneratorOptions = {
      projectName: "my-conflict",
      scope: "@test",
      preset: "blank",
      webApps: [],
      apiHosting: "standalone",
      db: [],
      agentRules: false,
      installDeps: false,
      initGit: false,
    };

    // Generate once
    await generate(testDir, options);

    let error: unknown;
    try {
      await generate(testDir, options);
    } catch (err) {
      error = err;
    }

    expect(error).toBeInstanceOf(DirectoryNotEmptyProblem);
    expect(error).toMatchObject({
      code: "create-croco-app/directory-not-empty",
      extensions: {
        recovery:
          "Choose an empty directory, remove the existing files, or pass a new target directory.",
      },
    });
  });
});
