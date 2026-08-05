import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  GENERATED_NODE_ENGINE_RANGE,
  GENERATED_NODE_VERSION,
} from "../../packages/create-croco-app/src/node-runtime.js";
import { validateGeneratedSaasDocsContract } from "../first-success-generated-contract.mts";

const scriptPath = resolve(__dirname, "../first-success-verify.mts");
const tempRoots: string[] = [];
const validCreateCommand =
  "npx create-croco-app@latest my-saas-api --goal saas-api --scope @myorg --no-install --no-git";
const saasPackageName = "@croco-example/saas-billing-golden-path";
const saasSmokeScript = `pnpm --filter ${saasPackageName}... build && pnpm --filter ${saasPackageName} test`;
const fixtureSpineStatusSummary =
  "Current 1.0 spine status: 2 spine packages; 1 production-ready, 1 beta, 0 alpha/WIP, 0 deprecated; 1 beta promotion records.";
const firstSuccessCommands = [
  "pnpm quick-start-lambda:smoke",
  "pnpm saas-billing-golden-path:smoke",
  "pnpm first-success:verify",
];
const rootReadmeToolingCommands = [
  "pnpm build",
  "pnpm lint",
  "pnpm format",
  "pnpm check",
  "pnpm docs:catalog:check",
  "pnpm first-success:verify",
  "pnpm release-docs:check",
  "pnpm release:spine-evidence",
  "pnpm test",
  "pnpm typecheck",
];
const defaultSaasReadmeCommands = [
  `pnpm --filter ${saasPackageName} dev`,
  "pnpm saas-billing-golden-path:smoke",
  `pnpm --filter ${saasPackageName} test`,
  `pnpm --filter ${saasPackageName} typecheck`,
  `pnpm --filter ${saasPackageName} build`,
];

type ScriptResult = {
  readonly stdout: string;
  readonly stderr: string;
  readonly status: number | null;
};

type FixtureOptions = {
  readonly rootReadmeCommand?: string;
  readonly rootQuickStartSmokeScript?: string;
  readonly docsIndexPackageCount?: number;
  readonly extraReadmeToolingCommand?: string;
  readonly gettingStartedDevCommand?: string;
  readonly gettingStartedPackageCount?: number;
  readonly includeSaasGettingStartedReference?: boolean;
  readonly omitReleaseFirstSuccessCommand?: string;
  readonly omittedReadmeToolingCommand?: string;
  readonly packageReadmeCommand?: string | null;
  readonly packageReadmeExtraCommand?: string;
  readonly rootSaasSmokeScript?: string | null;
  readonly saasReadmeCommands?: readonly string[];
  readonly staleReadmeRoadmapStatus?: boolean;
  readonly staleSpineStatus?: boolean;
};

describe("first-success-verify.mts", () => {
  beforeAll(() => {
    const result = spawnSync("pnpm", ["build", "--filter=create-croco-app"], {
      cwd: resolve(__dirname, "../.."),
      encoding: "utf-8",
    });

    expect(result.status, result.stderr || result.stdout).toBe(0);
  }, 120_000);

  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      rmSync(root, { force: true, recursive: true });
    }
  });

  it("passes a complete first-success fixture", () => {
    const root = createFixture();

    const result = runScript(root);

    expect(result.status, result.stderr || result.stdout).toBe(0);
    expect(result.stdout).toContain("first-success contract verification PASSED");
  });

  it("accepts the authoritative quick-start smoke dispatcher", () => {
    const root = createFixture({
      rootQuickStartSmokeScript:
        "node --experimental-strip-types scripts/verification-command.mts --id quick-start-lambda-smoke",
    });

    const result = runScript(root);

    expect(result.status, result.stderr || result.stdout).toBe(0);
  });

  it("rejects a quick-start smoke dispatcher with the wrong command ID", () => {
    const root = createFixture({
      rootQuickStartSmokeScript:
        "node --experimental-strip-types scripts/verification-command.mts --id first-success",
    });

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("does not run the smoke script");
  });

  it("fails through the real CLI contract when a public scaffold command omits scope", () => {
    const root = createFixture({
      rootReadmeCommand:
        "npx create-croco-app@latest my-saas-api --goal saas-api --no-install --no-git",
    });

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("README.md");
    expect(result.stdout).toContain("failed the real CLI contract");
    expect(result.stdout).toContain("directory, --scope, and --goal or --preset");
  });

  it("fails when a public command uses an option absent from the real Commander surface", () => {
    const root = createFixture({
      rootReadmeCommand:
        "npx create-croco-app@latest my-saas-api --goal saas-api --scope @myorg --package-manager pnpm --no-install --no-git",
    });

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("unknown option '--package-manager'");
  });

  it("fails when a valid generated command resolves to a different journey", () => {
    const root = createFixture({
      rootReadmeCommand:
        "npx create-croco-app@latest my-api --preset ddd-api --scope @myorg --api graphql --no-install --no-git",
    });

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain(
      "resolves to preset ddd-api, not the canonical goal saas-api journey",
    );
  });

  it("fails when the create-croco-app package README omits the public command", () => {
    const root = createFixture({ packageReadmeCommand: null });

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain(
      "create-croco-app package README missing a public create-croco-app command",
    );
  });

  it("allows an additional valid noncanonical scaffold command beside the canonical journey", () => {
    const root = createFixture({
      packageReadmeExtraCommand: [
        "npx create-croco-app@latest my-app \\",
        "  --preset ddd-fullstack \\",
        "  --scope @myorg \\",
        "  --api graphql \\",
        "  --api-hosting standalone \\",
        "  --web-apps web \\",
        "  --frontend-deploy vite-spa \\",
        "  --ui astryx \\",
        "  --no-install \\",
        "  --no-git",
      ].join("\n"),
    });

    const result = runScript(root);

    expect(result.status, result.stderr || result.stdout).toBe(0);
    expect(result.stdout).toContain("first-success contract verification PASSED");
  });

  it("fails when public package-count claims drift from the generated report", () => {
    const root = createFixture({ gettingStartedPackageCount: 98 });

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("getting-started guide package-count claim 98");
    expect(result.stdout).toContain("public package count 97");
  });

  it("fails when the SaaS README drops the local test command", () => {
    const root = createFixture({
      saasReadmeCommands: defaultSaasReadmeCommands.filter(
        (command) => command !== `pnpm --filter ${saasPackageName} test`,
      ),
    });

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("S1b");
    expect(result.stdout).toContain("SaaS README missing local test command");
  });

  it("fails when the SaaS README drops the root smoke command", () => {
    const root = createFixture({
      saasReadmeCommands: defaultSaasReadmeCommands.filter(
        (command) => command !== "pnpm saas-billing-golden-path:smoke",
      ),
    });

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("S1c");
    expect(result.stdout).toContain("SaaS README missing root smoke command");
  });

  it("fails when the quick-start bootstrap bypasses security validation", () => {
    const root = createFixture();
    writeFile(
      root,
      "examples/quick-start-lambda/src/app/bootstrap.ts",
      secureBootstrapFixture('securityValidation: "off",'),
    );

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("A1g");
    expect(result.stdout).toContain("must not bypass default security validation");
  });

  it("fails when a non-bootstrap example file uses the alternate security bypass", () => {
    const root = createFixture();
    writeFile(
      root,
      "examples/quick-start-lambda/src/local-demo.ts",
      "createApp({ unsafeSkipSecurityValidation: true });\n",
    );

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("A1g");
    expect(result.stdout).toContain("local-demo.ts");
  });

  it("fails when an example environment file overrides security validation", () => {
    const root = createFixture();
    writeFile(
      root,
      "examples/saas-billing-golden-path/.env.staging",
      "CROCO_HTTP_SECURITY_VALIDATION: off\n",
    );

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("S8a");
    expect(result.stdout).toContain(".env.staging");
  });

  it("fails when the SaaS bootstrap omits a required security capability", () => {
    const root = createFixture();
    writeFile(
      root,
      "examples/saas-billing-golden-path/src/app/bootstrap.ts",
      secureBootstrapFixture().replace("rateLimitHttpMiddleware({ rateLimiter }),", ""),
    );

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("S8b");
    expect(result.stdout).toContain("missing rateLimitHttpMiddleware");
  });

  it("fails when an example rate limiter does not use the credential-free store", () => {
    const root = createFixture();
    writeFile(
      root,
      "examples/saas-billing-golden-path/src/app/bootstrap.ts",
      secureBootstrapFixture().replace("SlidingWindowInMemoryStore", "ExternalRateLimitStore"),
    );

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("S8e");
    expect(result.stdout).toContain("must use SlidingWindowInMemoryStore");
  });

  it("fails when an example does not pass its credential-free rate limiter to HTTP middleware", () => {
    const root = createFixture();
    writeFile(
      root,
      "examples/saas-billing-golden-path/src/app/bootstrap.ts",
      secureBootstrapFixture().replace(
        "rateLimitHttpMiddleware({ rateLimiter })",
        "rateLimitHttpMiddleware({ rateLimiter: anotherRateLimiter })",
      ),
    );

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("S8e");
    expect(result.stdout).toContain("pass it to rateLimitHttpMiddleware");
  });

  it("fails when the root SaaS smoke script no longer builds workspace dependencies before tests", () => {
    const root = createFixture({
      rootSaasSmokeScript: `pnpm --filter ${saasPackageName} test`,
    });

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("S3");
    expect(result.stdout).toContain(
      "does not build the example and workspace dependencies before running the checked-in example tests",
    );
  });

  it("fails when getting-started docs drop the checked-in SaaS golden path reference", () => {
    const root = createFixture({ includeSaasGettingStartedReference: false });

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("S7a");
    expect(result.stdout).toContain(
      "Getting started docs missing reference to saas-billing-golden-path",
    );
  });

  it("fails when the generated SaaS runtime walkthrough drifts from the scaffold contract", () => {
    const root = createFixture({
      gettingStartedDevCommand:
        "SAAS_DEMO_ENDPOINTS_ENABLED=true pnpm --filter @wrong/api-server dev",
    });

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("D3");
    expect(result.stdout).toContain(
      "docs missing generated SaaS runtime contract `SAAS_DEMO_ENDPOINTS_ENABLED=true pnpm --filter @myorg/api-server dev`",
    );
  });

  it("fails when the generated runtime port drifts from the documented URLs", () => {
    const targetDir = createGeneratedRuntimeFixture();
    const docsContent = [
      "apps/api-server/src/controllers/SaasController.ts",
      "apps/api-server/src/controllers/OperationsController.ts",
      "SAAS_DEMO_ENDPOINTS_ENABLED=true pnpm --filter @myorg/api-server dev",
      "http://localhost:3000/saas/demo/seed",
      "http://localhost:3000/saas/demo/smoke",
      "http://localhost:3000/ops/health",
      "pnpm contract:check",
    ].join("\n");
    writeFile(targetDir, "apps/api-server/src/index.ts", "const port = Number(value ?? 4000);\n");

    const failures = validateGeneratedSaasDocsContract(targetDir, docsContent);

    expect(failures).toContain(
      "docs missing generated SaaS runtime contract `http://localhost:4000/saas/demo/seed`",
    );
    expect(failures).toContain(
      "docs missing generated SaaS runtime contract `http://localhost:4000/ops/health`",
    );
  });

  it("fails when the root README drops a checked tooling command", () => {
    const root = createFixture({
      omittedReadmeToolingCommand: "pnpm docs:catalog:check",
    });

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("D7");
    expect(result.stdout).toContain(
      "README.md missing root tooling command `pnpm docs:catalog:check` in ### 주요 명령어",
    );
  });

  it("fails when the root README documents an unknown tooling command", () => {
    const root = createFixture({
      extraReadmeToolingCommand: "pnpm made-up-tooling-command",
    });

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("D7");
    expect(result.stdout).toContain(
      "README.md documents unknown root tooling command `pnpm made-up-tooling-command`",
    );
  });

  it("fails when release spine docs drop a first-success command", () => {
    const root = createFixture({
      omitReleaseFirstSuccessCommand: "pnpm first-success:verify",
    });

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("D6");
    expect(result.stdout).toContain(
      "Croco 1.0 spine release docs missing first-success command `pnpm first-success:verify`",
    );
  });

  it("fails when public spine status drifts from the catalog", () => {
    const root = createFixture({ staleSpineStatus: true });

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("D8");
    expect(result.stdout).toContain("missing generated spine status");
    expect(result.stdout).toContain(fixtureSpineStatusSummary);
  });

  it("fails when README roadmap status drifts while the generated catalog status is current", () => {
    const root = createFixture({ staleReadmeRoadmapStatus: true });

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("D8");
    expect(result.stdout).toContain(
      "README.md readiness status section missing generated spine status",
    );
    expect(result.stdout).toContain(fixtureSpineStatusSummary);
  });
});

function createGeneratedRuntimeFixture(): string {
  const root = mkdtempSync(join(tmpdir(), "croco-generated-runtime-"));
  tempRoots.push(root);
  writeFile(root, "package.json", JSON.stringify({ scripts: { "contract:check": "croco" } }));
  writeFile(root, "apps/api-server/package.json", JSON.stringify({ name: "@myorg/api-server" }));
  writeFile(
    root,
    "apps/api-server/src/controllers/SaasController.ts",
    "export class SaasController {}\n",
  );
  writeFile(
    root,
    "apps/api-server/src/controllers/OperationsController.ts",
    "export class OperationsController {}\n",
  );
  writeFile(
    root,
    "apps/api-server/src/providerProfiles.ts",
    'export const SAAS_DEMO_ENDPOINTS_ENABLED_ENV = "SAAS_DEMO_ENDPOINTS_ENABLED";\n',
  );
  writeFile(root, "apps/api-server/src/index.ts", "const port = Number(value ?? 3000);\n");
  writeFile(
    root,
    "apps/api-server/src/controllers/schemas.ts",
    [
      'export const healthRoute = defineRouteContract({ path: "/ops/health" });',
      'export const seedSaasDemoRoute = defineRouteContract({ path: "/saas/demo/seed" });',
      'export const smokeSaasDemoRoute = defineRouteContract({ path: "/saas/demo/smoke" });',
      "",
    ].join("\n"),
  );
  return root;
}

function createFixture(options: FixtureOptions = {}): string {
  const root = mkdtempSync(join(tmpdir(), "croco-first-success-"));
  tempRoots.push(root);

  const rootReadmeCommand = options.rootReadmeCommand ?? validCreateCommand;
  const packageReadmeCommand =
    options.packageReadmeCommand === undefined ? validCreateCommand : options.packageReadmeCommand;
  const docsIndexPackageCount = options.docsIndexPackageCount ?? 97;
  const gettingStartedPackageCount = options.gettingStartedPackageCount ?? 97;
  const gettingStartedDevCommand =
    options.gettingStartedDevCommand ??
    "SAAS_DEMO_ENDPOINTS_ENABLED=true pnpm --filter @myorg/api-server dev";
  const rootSaasSmokeScript =
    options.rootSaasSmokeScript === undefined ? saasSmokeScript : options.rootSaasSmokeScript;
  const saasReadmeCommands = options.saasReadmeCommands ?? defaultSaasReadmeCommands;
  const includeSaasGettingStartedReference = options.includeSaasGettingStartedReference !== false;
  const staleSpineStatusSummary =
    "Current 1.0 spine status: 2 spine packages; 0 production-ready, 2 beta, 0 alpha/WIP, 0 deprecated; 0 beta promotion records.";
  const readmeRoadmapStatusSummary =
    options.staleSpineStatus || options.staleReadmeRoadmapStatus
      ? staleSpineStatusSummary
      : fixtureSpineStatusSummary;
  const releaseSpineStatusSummary = options.staleSpineStatus
    ? staleSpineStatusSummary
    : fixtureSpineStatusSummary;
  const readmeToolingCommands = rootReadmeToolingCommands.filter(
    (command) => command !== options.omittedReadmeToolingCommand,
  );
  if (options.extraReadmeToolingCommand) {
    readmeToolingCommands.push(options.extraReadmeToolingCommand);
  }
  const rootScripts: Record<string, string> = {
    build: "turbo build",
    check: "pnpm docs:catalog:check && pnpm first-success:verify",
    "docs:catalog:check": "node --experimental-strip-types scripts/package-docs-check.mts --check",
    "first-success:verify": "node --experimental-strip-types scripts/first-success-verify.mts",
    format: "oxfmt --write .",
    lint: "turbo lint",
    "quick-start-lambda:smoke":
      options.rootQuickStartSmokeScript ??
      "node --experimental-strip-types scripts/quick-start-lambda-smoke.mts",
    "release-docs:check": "node --experimental-strip-types scripts/release-docs-check.mts",
    "release:spine-evidence": "node --experimental-strip-types scripts/release-spine-evidence.mts",
    test: "turbo test",
    typecheck: "turbo typecheck",
  };
  if (rootSaasSmokeScript !== null) {
    rootScripts["saas-billing-golden-path:smoke"] = rootSaasSmokeScript;
  }

  writeFile(root, "package.json", JSON.stringify({ scripts: rootScripts }, null, 2));
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
      "## 🗺️ 로드맵 — 1.0 readiness status",
      "",
      readmeRoadmapStatusSummary,
      "",
      "```bash",
      ...firstSuccessCommands,
      "```",
      "",
      "---",
      "",
      "<!-- CROCO:PACKAGE-CATALOG:START -->",
      fixtureSpineStatusSummary,
      "<!-- CROCO:PACKAGE-CATALOG:END -->",
      "",
      "## 🛠 개발 환경",
      "",
      "### 주요 명령어",
      "",
      "```bash",
      ...readmeToolingCommands,
      "```",
      "",
      "### Git Hooks",
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
      "pnpm quick-start-lambda:smoke",
      `Node.js ${GENERATED_NODE_ENGINE_RANGE}`,
      `nvm install ${GENERATED_NODE_VERSION}`,
      "x-api-key: test-key",
      "401",
      "api_user_create",
      "The HTTP bootstrap uses security headers, CORS, a body limit, and an in-memory rate limiter without credentials. Disabling security validation is reserved for temporary local migration or test fixtures.",
      "",
    ].join("\n"),
  );
  writeFile(
    root,
    "examples/quick-start-lambda/package.json",
    JSON.stringify(
      {
        dependencies: { "@croco/ratelimit-core": "workspace:*" },
        scripts: { dev: "tsx src/index.ts" },
      },
      null,
      2,
    ),
  );
  writeFile(
    root,
    "examples/saas-billing-golden-path/README.md",
    [
      "# SaaS Billing Golden Path Example",
      "",
      "Primary action: `POST /api/checkouts` creates a paid order.",
      "",
      "## Run Locally",
      "",
      "```bash",
      ...saasReadmeCommands,
      "```",
      "The HTTP bootstrap uses security headers, CORS, a body limit, and an in-memory rate limiter without credentials. Disabling security validation is reserved for temporary local migration or test fixtures.",
      "",
    ].join("\n"),
  );
  writeFile(
    root,
    "examples/saas-billing-golden-path/package.json",
    JSON.stringify(
      {
        dependencies: { "@croco/ratelimit-core": "workspace:*" },
        scripts: {
          build: "tsc --noEmit",
          dev: "tsx src/index.ts",
          test: "vitest run src/tests",
          typecheck: "tsc --noEmit",
        },
      },
      null,
      2,
    ),
  );
  writeFile(
    root,
    "examples/saas-billing-golden-path/src/protocols/BillingController.ts",
    [
      '@Controller("/api")',
      "export class BillingController {",
      '  @Post("/checkouts")',
      "  checkout() { return {}; }",
      "",
      '  @Get("/orders/:id")',
      "  getOrder() { return {}; }",
      "",
      '  @Get("/backoffice/audit")',
      "  listAuditTrail() { return {}; }",
      "}",
      "",
    ].join("\n"),
  );
  writeFile(
    root,
    "examples/saas-billing-golden-path/src/domain/CheckoutService.ts",
    [
      "export class CheckoutService {",
      "  private readonly retry = new RetryTemplate();",
      "  checkout() {",
      "    return withSpan(() => {",
      "      this.publisher.publishAfterCommit();",
      "      throw new CheckoutValidationProblem('invalid');",
      "    });",
      "  }",
      "  getOrder() { throw new OrderNotFoundProblem('missing'); }",
      "}",
      "",
    ].join("\n"),
  );
  writeFile(
    root,
    "examples/saas-billing-golden-path/src/tests/golden-path.spec.ts",
    [
      "it('checks out an order, retries transient payment failure, and records audit', () => {});",
      "expect(problem.code).toBe('golden-path/checkout-validation');",
      "expect(problem.code).toBe('golden-path/payment-declined');",
      "expect(problem.code).toBe('golden-path/order-not-found');",
      "",
    ].join("\n"),
  );
  writeFile(root, "examples/quick-start-lambda/src/app/bootstrap.ts", secureBootstrapFixture());
  writeFile(
    root,
    "examples/saas-billing-golden-path/src/app/bootstrap.ts",
    secureBootstrapFixture(),
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
      "list() { return []; }",
      "",
      "@Post()",
      "@UseGuards(AuthGuard)",
      '@Meter({ meterId: "api_user_create" })',
      '@Metered({ meterId: "api_user_create" })',
      "create() { return {}; }",
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
    "packages/create-croco-app/README.md",
    packageReadmeCommand
      ? [
          "# create-croco-app",
          "",
          "```bash",
          packageReadmeCommand,
          "```",
          ...(options.packageReadmeExtraCommand
            ? ["", "```bash", options.packageReadmeExtraCommand, "```"]
            : []),
          "",
        ].join("\n")
      : "# create-croco-app\n",
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
      "pnpm quick-start-lambda:smoke",
      "pnpm first-success:verify",
      "apps/api-server/src/controllers/SaasController.ts",
      "apps/api-server/src/controllers/OperationsController.ts",
      gettingStartedDevCommand,
      "http://localhost:3000/saas/demo/seed",
      "http://localhost:3000/saas/demo/smoke",
      "http://localhost:3000/ops/health",
      "pnpm contract:check",
      ...(includeSaasGettingStartedReference
        ? [
            "See examples/saas-billing-golden-path for billing, retry, transactions, events, and Problems.",
            "pnpm saas-billing-golden-path:smoke",
          ]
        : []),
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
    "docs/package-catalog.json",
    JSON.stringify(
      {
        maturity: {
          alpha: { packages: [] },
          beta: { packages: ["beta"] },
          deprecated: { packages: [] },
          production: { packages: ["alpha"] },
        },
        spine: {
          packages: ["alpha", "beta"],
          promotion: {
            packages: {
              beta: {
                owner: "fixture-owner",
                recoveryAction: "Complete fixture evidence.",
                targetEvidence: ["fixture evidence"],
              },
            },
          },
        },
      },
      null,
      2,
    ),
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
  writeFile(
    root,
    "docs/release/croco-1.0-spine.md",
    [
      "# Croco 1.0 Spine",
      "",
      releaseSpineStatusSummary,
      "",
      "```bash",
      ...firstSuccessCommands.filter(
        (command) => command !== options.omitReleaseFirstSuccessCommand,
      ),
      "```",
      "",
    ].join("\n"),
  );

  return root;
}

function secureBootstrapFixture(extraConfig = ""): string {
  return [
    "const rateLimiter = new RateLimiter(",
    "new SlidingWindowInMemoryStore(),",
    'new RateLimitKeyBuilder(["ip"]),',
    ");",
    "createApp({",
    extraConfig,
    "middlewares: [",
    "securityHeadersMiddleware(),",
    "corsMiddleware(),",
    "bodyLimitMiddleware(),",
    "rateLimitHttpMiddleware({ rateLimiter }),",
    "],",
    "});",
    "",
  ].join("\n");
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
