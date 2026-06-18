import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const scriptPath = resolve(__dirname, "../first-success-verify.mts");
const tempRoots: string[] = [];
const validCreateCommand =
  "npx create-croco-app@latest my-project --preset ddd-api --scope @myorg --api graphql --backend-deploy lambda --no-install --no-git";

type ScriptResult = {
  readonly stdout: string;
  readonly stderr: string;
  readonly status: number | null;
};

type FixtureOptions = {
  readonly rootReadmeCommand?: string;
  readonly docsIndexPackageCount?: number;
  readonly gettingStartedPackageCount?: number;
};

describe("first-success-verify.mts", () => {
  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      rmSync(root, { force: true, recursive: true });
    }
  });

  it("fails when a public scaffold command omits ddd-api noninteractive values", () => {
    const root = createFixture({
      rootReadmeCommand:
        "npx create-croco-app@latest my-project --preset ddd-api --backend-deploy lambda --no-install --no-git",
    });

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("README.md");
    expect(result.stdout).toContain("--scope=<missing>");
    expect(result.stdout).toContain("--api=<missing>");
  });

  it("fails when public package-count claims drift from the generated report", () => {
    const root = createFixture({ gettingStartedPackageCount: 98 });

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("getting-started guide package-count claim 98");
    expect(result.stdout).toContain("public package count 97");
  });
});

function createFixture(options: FixtureOptions = {}): string {
  const root = mkdtempSync(join(tmpdir(), "croco-first-success-"));
  tempRoots.push(root);

  const rootReadmeCommand = options.rootReadmeCommand ?? validCreateCommand;
  const docsIndexPackageCount = options.docsIndexPackageCount ?? 97;
  const gettingStartedPackageCount = options.gettingStartedPackageCount ?? 97;

  writeFile(
    root,
    "README.md",
    [
      "# Croco",
      "",
      "## Quick Start",
      "",
      "```bash",
      rootReadmeCommand,
      "cd my-project && pnpm install && pnpm dev",
      "```",
      "",
    ].join("\n"),
  );
  writeFile(
    root,
    "examples/quick-start-lambda/README.md",
    [
      "# Quick Start Lambda",
      "",
      "pnpm install",
      "pnpm dev",
      "x-api-key: test-key",
      "401",
      "api_user_create",
      "",
    ].join("\n"),
  );
  writeFile(
    root,
    "examples/quick-start-lambda/package.json",
    JSON.stringify({ scripts: { dev: "tsx src/index.ts" } }, null, 2),
  );
  writeFile(
    root,
    "examples/quick-start-lambda/src/index.ts",
    [
      'import { createLambdaExampleApp } from "./app/bootstrap";',
      "const app = createLambdaExampleApp();",
      "export const handler = app.lambdaHandler();",
      "",
    ].join("\n"),
  );
  writeFile(
    root,
    "examples/quick-start-lambda/src/protocols/HealthController.ts",
    ['@Controller("/api")', '@Get("/health")', 'return { status: "ok" }', ""].join("\n"),
  );
  writeFile(
    root,
    "examples/quick-start-lambda/src/protocols/UserController.ts",
    [
      '@Controller("/api/users")',
      "@Get()",
      "@UseGuards(AuthGuard)",
      "@Post()",
      '@Meter({ meterId: "api_user_create" })',
      '@Metered({ meterId: "api_user_create" })',
      "",
    ].join("\n"),
  );
  writeFile(
    root,
    "examples/quick-start-lambda/src/integrations/TestAuthProvider.ts",
    ['"test-key"', "return null", ""].join("\n"),
  );
  writeFile(
    root,
    "packages/create-croco-app/src/prompts.ts",
    ['"ddd-api"', "Basic DDD skeleton (Drizzle ORM + env utils)", ""].join("\n"),
  );
  writeFile(
    root,
    "packages/docs/src/content/docs/en/index.mdx",
    [
      "# Croco Framework",
      "",
      `> \`${validCreateCommand}\``,
      "",
      `${docsIndexPackageCount} packages organized by maturity.`,
      "",
    ].join("\n"),
  );
  writeFile(
    root,
    "packages/docs/src/content/docs/en/guides/getting-started.mdx",
    [
      "# Getting Started",
      "",
      "See examples/quick-start-lambda for a working example.",
      "",
      "```bash",
      validCreateCommand,
      "```",
      "",
      `Browse all ${gettingStartedPackageCount} packages by domain and maturity.`,
      "",
    ].join("\n"),
  );
  writeFile(
    root,
    "docs/package-docs-report.md",
    [
      "# Package Documentation Report",
      "",
      "## Summary",
      "",
      "| Metric | Count |",
      "| --- | ---: |",
      "| Public packages | 97 |",
      "| Private packages skipped | 2 |",
      "",
    ].join("\n"),
  );

  return root;
}

function writeFile(root: string, relativePath: string, content: string): void {
  const filePath = join(root, relativePath);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
}

function runScript(root: string): ScriptResult {
  const result = spawnSync("node", ["--experimental-strip-types", scriptPath, "--root", root], {
    encoding: "utf-8",
  });

  return {
    stdout: result.stdout,
    stderr: result.stderr,
    status: result.status,
  };
}
