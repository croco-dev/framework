import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const TEMPLATES_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../templates");
const FIXTURE_TEMPLATES_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../test-fixtures",
  "templates",
);
const FIXTURE_TEMPLATE_NAMES = new Set(["container-fullstack", "ssr-lambda"]);
const GENERATED_API_DI_GRAPH_SCRIPT =
  "cross-env NODE_OPTIONS=--import=tsx croco di graph --module src/app.ts --bootstrap createCrocoApp --roots createCrocoDiGraphRoots --write ../../.croco/build/di-graph.manifest.json";

function templatePath(template: string, ...paths: string[]): string {
  const templatesDir = FIXTURE_TEMPLATE_NAMES.has(template) ? FIXTURE_TEMPLATES_DIR : TEMPLATES_DIR;

  return join(templatesDir, template, ...paths);
}

function checkFileExists(template: string, ...paths: string[]) {
  const fullPath = templatePath(template, ...paths);

  expect(existsSync(fullPath), `Missing: ${fullPath}`).toBe(true);
}

function checkDirectoryExists(template: string, ...paths: string[]) {
  const fullPath = templatePath(template, ...paths);

  expect(existsSync(fullPath), `Missing: ${fullPath}`).toBe(true);
  expect(statSync(fullPath).isDirectory(), `Not a directory: ${fullPath}`).toBe(true);
}

function checkFileContains(template: string, filePath: string[], pattern: string | RegExp) {
  const content = readFileSync(templatePath(template, ...filePath), "utf-8");

  expect(content).toMatch(pattern);
}

function checkFileDoesNotContain(template: string, filePath: string[], pattern: string | RegExp) {
  const content = readFileSync(templatePath(template, ...filePath), "utf-8");

  expect(content).not.toMatch(pattern);
}

function readJsonTemplate(template: string, ...paths: string[]): Record<string, unknown> {
  const content = readFileSync(templatePath(template, ...paths), "utf-8");

  return JSON.parse(content);
}

function checkConsoleWebManifestDependency(template: string, packageName: string) {
  const manifest = readJsonTemplate(template, "apps", "console-web", "package.json.hbs");
  const dependencyFields = [
    manifest.dependencies,
    manifest.devDependencies,
    manifest.peerDependencies,
    manifest.optionalDependencies,
  ];

  expect(
    dependencyFields.some(
      (dependencies) =>
        dependencies !== null && typeof dependencies === "object" && packageName in dependencies,
    ),
    `${template} apps/console-web/package.json.hbs should declare ${packageName}`,
  ).toBe(true);
}

function listPageFiles(template: string): string[] {
  const pagesDir = templatePath(template, "apps", "console-web", "pages");

  return readdirSync(pagesDir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name).replace(`${pagesDir}/`, ""));
}

function checkSsrRouteComponent(template: string) {
  const routePath = ["apps", "console-web", "pages", "route.ts"];

  checkFileContains(template, routePath, /import Page from ["']\.\/index\/Page["'];/);
  checkFileContains(template, routePath, /type PageRouteDefinition/);
  checkFileContains(template, routePath, /component:\s*Page,/);
  checkFileContains(template, routePath, /satisfies PageRouteDefinition/);
  checkFileDoesNotContain(template, routePath, /import type \{ default as Page/);
  checkFileDoesNotContain(template, routePath, /component:\s*undefined/);
}

function checkSpaBeSplitStructure() {
  checkFileExists("spa-be-split", "sst.config.ts.hbs");
  checkFileExists("spa-be-split", "sst-env.d.ts");
  checkFileExists("spa-be-split", "apps", "api-server", "package.json.hbs");
  readJsonTemplate("spa-be-split", "apps", "api-server", "package.json.hbs");
  checkFileContains(
    "spa-be-split",
    ["apps", "api-server", "src", "app.ts"],
    /@croco\/transports-http/,
  );
  checkFileContains(
    "spa-be-split",
    ["apps", "api-server", "src", "app.ts"],
    /globalFilters:\s*\[HttpExceptionFilter\]/,
  );
  checkFileContains("spa-be-split", ["apps", "api-server", "src", "index.ts"], /createCrocoApp/);
  checkFileContains("spa-be-split", ["apps", "api-server", "src", "index.ts"], /TelemetryRuntime/);
  checkFileContains(
    "spa-be-split",
    ["apps", "api-server", "src", "lambda.ts"],
    /export const handler/,
  );
  checkFileContains("spa-be-split", ["apps", "api-server", "src", "lambda.ts"], /forceFlush/);
  checkFileContains(
    "spa-be-split",
    ["apps", "api-server", "src", "env.ts"],
    /InvalidEnvironmentProblem/,
  );
  checkFileContains(
    "spa-be-split",
    ["apps", "api-server", "src", "problems.ts"],
    /ProblemCategory/,
  );
  checkFileContains("spa-be-split", ["apps", "api-server", "src", "users.ts"], /Repository/);
  checkFileContains("spa-be-split", ["apps", "api-server", "src", "users.ts"], /RetryTemplate/);
  checkFileContains("spa-be-split", ["apps", "api-server", "src", "users.ts"], /EventPublisher/);
  checkFileContains("spa-be-split", ["apps", "api-server", "src", "users.ts"], /InMemoryEventBus/);
  checkFileExists("spa-be-split", "apps", "console-web", "package.json.hbs");
  checkConsoleWebManifestDependency("spa-be-split", "@croco/frontend-vite");
  checkFileExists("spa-be-split", "apps", "console-web", "src", "main.tsx");
  checkFileExists("spa-be-split", "apps", "console-web", "vite.config.ts.hbs");
  checkFileContains(
    "spa-be-split",
    ["apps", "console-web", "src", "api", "client.ts"],
    /handleJsonResponse/,
  );

  for (const directory of ["service", "domain", "datasource", "feature", "page", "ui"]) {
    checkDirectoryExists("spa-be-split", "libs", "sample-domain", directory);
  }

  checkFileExists("spa-be-split", "libs", "shared", "provider-rpc", "package.json.hbs");
  checkFileExists("spa-be-split", "libs", "shared", "provider-rpc", "tsconfig.json.hbs");

  const rootPackageJson = readJsonTemplate("spa-be-split", "package.json.hbs");
  expect(rootPackageJson).toMatchObject({
    scripts: expect.objectContaining({
      dev: "turbo dev",
      "dev:api": expect.any(String),
      "dev:web": expect.any(String),
      "dev:smoke": expect.stringMatching(/api-server dev:smoke[\s\S]*console-web dev:smoke/),
      "contract:check": expect.stringMatching(
        /croco-rpc-codegen[\s\S]*--check[\s\S]*--strict-schemas/,
      ),
      "contract:snapshot": expect.stringMatching(
        /^croco contracts check[\s\S]*--strict-schemas[\s\S]*--json --out contract-graph\.snapshot\.json$/,
      ),
      "contract:diff": expect.stringMatching(
        /^croco contracts diff --baseline contract-graph\.snapshot\.json[\s\S]*--controllers[\s\S]*--strict-schemas$/,
      ),
      "contract:coverage": expect.stringMatching(
        /^croco contracts check[\s\S]*--strict-schemas[\s\S]*--json --out contract-graph\.coverage\.json$/,
      ),
      "project-map:write": expect.stringMatching(
        /^croco project map[\s\S]*--out croco\.project-map\.json --manifest-bundle \.croco\/manifest$/,
      ),
      "project-map:check": expect.stringMatching(
        /^croco project map[\s\S]*--check --manifest croco\.project-map\.json --manifest-bundle \.croco\/manifest$/,
      ),
      "contract:verify": expect.stringMatching(
        /^pnpm contract:diff && pnpm contract:coverage && pnpm project-map:write && pnpm project-map:check && pnpm contract:openapi && pnpm contract:client && pnpm --filter \{\{scope\}\}\/provider-rpc typecheck$/,
      ),
      "ci:contracts": "pnpm contract:verify",
      "di:graph": "pnpm --filter {{scope}}/api-server di:graph",
      "di:check": "croco di check .croco/build/di-graph.manifest.json",
      "di:assert": "node scripts/assert-di-graph.mjs .croco/build/di-graph.manifest.json",
      doctor: "croco doctor --json",
      "di:verify": expect.stringMatching(
        /^pnpm di:graph && pnpm di:check && pnpm di:assert && pnpm project-map:write && pnpm project-map:check && pnpm doctor$/,
      ),
      "contract:openapi": expect.stringMatching(
        /^pnpm contract:check &&[\s\S]*croco-openapi-spec[\s\S]*--strict-schemas[\s\S]*--manifest-bundle \.croco\/manifest$/,
      ),
      "contract:client": expect.stringMatching(
        /^pnpm contract:check &&[\s\S]*croco-rpc-codegen[\s\S]*--strict-schemas[\s\S]*--problem-runtime frontend-problems --manifest-bundle \.croco\/manifest[\s\S]*provider-rpc typecheck$/,
      ),
      codegen: expect.any(String),
      lint: "biome lint .",
      test: "turbo test",
    }),
    devDependencies: expect.objectContaining({
      "@croco/cli": "workspace:*",
      "@croco/openapi-spec": "workspace:*",
      "@croco/rpc-codegen": "workspace:*",
    }),
  });
  const apiPackageJson = readJsonTemplate("spa-be-split", "apps", "api-server", "package.json.hbs");
  expect(apiPackageJson).toMatchObject({
    scripts: expect.objectContaining({
      "di:graph": GENERATED_API_DI_GRAPH_SCRIPT,
      "dev:smoke": "tsx src/dev-smoke.ts",
      test: "vitest run",
    }),
    devDependencies: expect.objectContaining({
      "cross-env": "^10.1.0",
      vitest: expect.any(String),
    }),
    dependencies: expect.objectContaining({
      "@croco/events-core": "workspace:*",
      "@croco/events-inmemory": "workspace:*",
      "@croco/problems-core": "workspace:*",
      "@croco/repository-core": "workspace:*",
      "@croco/retry-core": "workspace:*",
      "@croco/telemetry-api": "workspace:*",
      "@croco/telemetry-sdk-node": "workspace:*",
      zod: expect.any(String),
    }),
  });
  const consolePackageJson = readJsonTemplate(
    "spa-be-split",
    "apps",
    "console-web",
    "package.json.hbs",
  );
  expect(consolePackageJson).toMatchObject({
    dependencies: expect.objectContaining({
      "@croco/frontend-problems": "workspace:*",
      "{{scope}}/provider-rpc": "workspace:*",
    }),
  });
  const rpcPackageJson = readJsonTemplate(
    "spa-be-split",
    "libs",
    "shared",
    "provider-rpc",
    "package.json.hbs",
  );
  expect(rpcPackageJson).toMatchObject({
    main: "./src/index.ts",
    types: "./src/index.ts",
    scripts: expect.objectContaining({
      typecheck: "tsc --noEmit",
    }),
    dependencies: expect.objectContaining({
      "@croco/frontend-problems": "workspace:*",
      "@croco/problems-core": "workspace:*",
      "@tanstack/react-query": expect.any(String),
    }),
  });
  checkFileContains(
    "spa-be-split",
    ["apps", "api-server", "src", "tests", "app.spec.ts"],
    /createCrocoApp/,
  );
  checkFileContains(
    "spa-be-split",
    ["apps", "api-server", "src", "tests", "app.spec.ts"],
    /starter\/user-not-found/,
  );
  checkFileContains(
    "spa-be-split",
    ["apps", "api-server", "src", "app.ts"],
    /export function createCrocoApp/,
  );
  checkFileContains(
    "spa-be-split",
    ["apps", "api-server", "src", "controllers", "UserController.ts"],
    /@Get\(getUserRoute\)/,
  );
  checkFileContains(
    "spa-be-split",
    ["apps", "api-server", "src", "controllers", "UserController.ts"],
    /@Body\(createUserRoute\)/,
  );
  checkFileContains(
    "spa-be-split",
    ["apps", "api-server", "src", "controllers", "UserController.ts"],
    /Promise<RouteResponse<typeof listUsersRoute>>/,
  );
  checkFileContains(
    "spa-be-split",
    ["apps", "api-server", "src", "controllers", "userSchemas.ts"],
    /defineRouteContract/,
  );
  checkFileExists("spa-be-split", "pnpm-workspace.yaml");
  checkFileContains("spa-be-split", ["README.md.hbs"], /운영형 앱 스타터/);
  checkFileContains("spa-be-split", ["README.md.hbs"], /비범위/);
  checkFileContains("spa-be-split", ["README.md.hbs"], /HttpExceptionFilter/);
  checkFileContains("spa-be-split", ["README.md.hbs"], /TelemetryRuntime\.forceFlush/);
}

function checkAdminConsoleStructure() {
  checkFileExists("admin-console", "package.json.hbs");
  checkFileExists("admin-console", "README.md.hbs");
  checkFileExists("admin-console", "apps", "api-server", "src", "admin.ts");
  checkFileExists("admin-console", "apps", "api-server", "src", "app.ts.hbs");
  checkFileExists(
    "admin-console",
    "apps",
    "api-server",
    "src",
    "controllers",
    "AdminController.ts",
  );
  checkFileExists("admin-console", "apps", "api-server", "src", "controllers", "adminSchemas.ts");
  checkFileExists("admin-console", "apps", "api-server", "src", "tests", "AdminConsole.spec.ts");
  checkFileExists("admin-console", "apps", "console-web", "src", "App.tsx.hbs");

  const rootPackageJson = readJsonTemplate("admin-console", "package.json.hbs");
  expect(rootPackageJson).toMatchObject({
    scripts: expect.objectContaining({
      "admin:smoke": expect.stringMatching(/^pnpm contract:client/),
      "contract:coverage": expect.stringMatching(/contract-graph\.coverage\.json/),
      "project-map:write": expect.stringMatching(
        /croco project map[\s\S]*croco\.project-map\.json --manifest-bundle \.croco\/manifest/,
      ),
      "project-map:check": expect.stringMatching(
        /croco project map[\s\S]*--check[\s\S]*--manifest-bundle \.croco\/manifest/,
      ),
      "contract:verify": expect.stringMatching(
        /contract:diff && pnpm contract:coverage && pnpm project-map:write && pnpm project-map:check/,
      ),
      "di:graph": "pnpm --filter {{scope}}/api-server di:graph",
      "di:check": "croco di check .croco/build/di-graph.manifest.json",
      "di:assert": "node scripts/assert-di-graph.mjs .croco/build/di-graph.manifest.json",
      doctor: "croco doctor --json",
      "di:verify": expect.stringMatching(
        /^pnpm di:graph && pnpm di:check && pnpm di:assert && pnpm project-map:write && pnpm project-map:check && pnpm doctor$/,
      ),
      "contract:client": expect.stringMatching(
        /admin\.ts,users\.ts,problems\.ts[\s\S]*--strict-schemas[\s\S]*--problem-runtime frontend-problems --manifest-bundle \.croco\/manifest/,
      ),
      typecheck: "pnpm contract:client && turbo typecheck",
      build: "pnpm contract:client && turbo build",
    }),
  });

  const apiPackageJson = readJsonTemplate(
    "admin-console",
    "apps",
    "api-server",
    "package.json.hbs",
  );
  expect(apiPackageJson).toMatchObject({
    scripts: expect.objectContaining({
      "di:graph": GENERATED_API_DI_GRAPH_SCRIPT,
      "admin:smoke": "tsx src/dev-smoke.ts",
    }),
    devDependencies: expect.objectContaining({
      "cross-env": "^10.1.0",
    }),
  });

  checkFileContains(
    "admin-console",
    ["apps", "api-server", "src", "controllers", "AdminController.ts"],
    /@ProblemResponse/,
  );
  checkFileContains(
    "admin-console",
    ["apps", "api-server", "src", "controllers", "AdminController.ts"],
    /admin-console\/user-not-found/,
  );
  checkFileContains("admin-console", ["apps", "console-web", "src", "App.tsx.hbs"], /adminClient/);
  checkFileContains(
    "admin-console",
    ["apps", "console-web", "src", "App.tsx.hbs"],
    /query: \{ tenantId: selectedTenantId \}/,
  );
  checkFileContains(
    "admin-console",
    ["apps", "console-web", "src", "App.tsx.hbs"],
    /admin-console\/invite-failed/,
  );
  checkFileContains(
    "admin-console",
    ["apps", "console-web", "src", "App.tsx.hbs"],
    /Probe Missing User/,
  );
  checkFileContains("admin-console", ["apps", "console-web", "src", "App.tsx.hbs"], /Operations/);
  checkFileContains("admin-console", ["README.md.hbs"], /operations timeline/);
  checkFileContains("admin-console", ["README.md.hbs"], /not a marketing landing page/);
}

function checkSsrLambdaStructure() {
  checkFileContains("ssr-lambda", ["README.md.hbs"], /@croco\/meta-vite/);
  checkFileDoesNotContain("ssr-lambda", ["README.md.hbs"], /Vike SSR/);
  checkFileExists("ssr-lambda", "apps", "api-server", "package.json.hbs");
  checkFileContains(
    "ssr-lambda",
    ["apps", "api-server", "package.json.hbs"],
    /@croco\/ratelimit-core/,
  );
  checkFileContains(
    "ssr-lambda",
    ["apps", "api-server", "src", "app.ts"],
    /securityHeadersMiddleware\(\)/,
  );
  checkFileContains(
    "ssr-lambda",
    ["apps", "api-server", "src", "app.ts"],
    /corsMiddleware\(\{ origins: \[process\.env\.WEB_ORIGIN \?\? "http:\/\/localhost:3000"\] \}\)/,
  );
  checkFileContains(
    "ssr-lambda",
    ["apps", "api-server", "src", "app.ts"],
    /bodyLimitMiddleware\(\{ limit: mb\(1\) \}\)/,
  );
  checkFileContains(
    "ssr-lambda",
    ["apps", "api-server", "src", "app.ts"],
    /rateLimitHttpMiddleware\(\{/,
  );
  checkFileDoesNotContain(
    "ssr-lambda",
    ["apps", "api-server", "src", "app.ts"],
    /securityValidation:\s*"off"/,
  );
  checkFileContains(
    "ssr-lambda",
    ["apps", "api-server", "src", "lambda.ts"],
    /export { lambdaHandler as handler }/,
  );
  checkFileExists("ssr-lambda", "apps", "console-web", "package.json.hbs");
  checkConsoleWebManifestDependency("ssr-lambda", "@croco/meta-vite");

  const pageFiles = listPageFiles("ssr-lambda");
  expect(pageFiles).toContain("route.ts");
  expect(pageFiles).toContain(join("index", "Page.tsx"));
  checkFileContains(
    "ssr-lambda",
    ["apps", "console-web", "pages", "index", "Page.tsx"],
    /export default function \w+\(/,
  );
  checkSsrRouteComponent("ssr-lambda");
}

function checkWebMetaViteFullstackAddonStructure() {
  checkFileContains(
    "addons/web-meta-vite-fullstack",
    ["pnpm-workspace.yaml.hbs"],
    /onlyBuiltDependencies:/,
  );
  checkFileContains("addons/web-meta-vite-fullstack", ["pnpm-workspace.yaml.hbs"], /- workerd/);
  checkFileContains(
    "addons/web-meta-vite-fullstack",
    ["api-worker", "src", "index.ts"],
    /WEB_ORIGIN\?: string/,
  );
  checkFileContains(
    "addons/web-meta-vite-fullstack",
    ["api-worker", "src", "index.ts"],
    /corsMiddleware\(\{ origins: \[webOrigin\] \}\)/,
  );
  checkFileContains(
    "addons/web-meta-vite-fullstack",
    ["api-worker", "src", "index.ts"],
    /OPERATIONAL_RATE_LIMIT_BYPASS_PATHS/,
  );
  checkFileContains(
    "addons/web-meta-vite-fullstack",
    ["api-worker", "src", "index.ts"],
    /new Set\(\[\s*"\/health",\s*"\/health\/live",\s*"\/health\/ready",\s*"\/ready",?\s*\]\)/,
  );
  checkFileContains(
    "addons/web-meta-vite-fullstack",
    ["api-worker", "src", "index.ts"],
    /skip: \(ctx\) => OPERATIONAL_RATE_LIMIT_BYPASS_PATHS\.has\(ctx\.req\.path\)/,
  );
  checkFileDoesNotContain(
    "addons/web-meta-vite-fullstack",
    ["api-worker", "wrangler.toml.hbs"],
    /^\s*\[build\]\s*$/m,
  );
}

function checkContainerFullstackStructure() {
  checkFileContains("container-fullstack", ["README.md.hbs"], /@croco\/meta-vite/);
  checkFileDoesNotContain("container-fullstack", ["README.md.hbs"], /Vike SSR/);
  checkFileContains("container-fullstack", ["Dockerfile"], /^FROM /gm);
  const dockerfileContent = readFileSync(
    templatePath("container-fullstack", "Dockerfile"),
    "utf-8",
  );
  expect(dockerfileContent.match(/^FROM /gm)?.length ?? 0).toBeGreaterThanOrEqual(3);
  checkFileExists("container-fullstack", "docker-compose.yml");
  checkFileExists("container-fullstack", "apps", "api-server", "package.json.hbs");
  checkFileContains(
    "container-fullstack",
    ["apps", "api-server", "src", "index.ts"],
    /\b(listen|createCrocoApp)\(/,
  );
  checkFileExists("container-fullstack", "apps", "console-web", "package.json.hbs");
  checkConsoleWebManifestDependency("container-fullstack", "@croco/meta-vite");

  const pageFiles = listPageFiles("container-fullstack");
  expect(pageFiles).toContain("route.ts");
  checkFileContains(
    "container-fullstack",
    ["apps", "console-web", "pages", "route.ts"],
    /mode:\s*['"]ssr['"]/,
  );
  checkSsrRouteComponent("container-fullstack");
}

function checkSaasStructure() {
  checkFileExists("saas", "package.json.hbs");
  checkFileExists("saas", "README.md.hbs");
  checkFileExists("saas", "apps", "api-server", "package.json.hbs");
  checkFileExists("saas", "apps", "api-server", "src", "saasDemo.ts");
  checkFileExists("saas", "apps", "api-server", "src", "providerProfiles.ts");
  checkFileExists("saas", "apps", "api-server", "src", "provider-profile-check.ts");
  checkFileExists("saas", "apps", "api-server", "src", "demo", "saasSmokeContract.ts");
  checkFileExists("saas", "apps", "api-server", "src", "inMemoryAdapters.ts");
  checkFileExists("saas", "apps", "api-server", "src", "controllers", "SaasController.ts");
  checkFileExists("saas", "apps", "api-server", "src", "controllers", "OperationsController.ts");
  checkFileExists("saas", "apps", "api-server", "src", "controllers", "JobsController.ts");
  checkFileExists("saas", "apps", "api-server", "src", "tests", "SaasDemo.spec.ts");
  checkFileExists("saas", "apps", "api-server", "src", "demo", "ops-smoke.ts");
  checkFileExists("saas", "libs", "shared", "provider-rpc", "package.json.hbs");

  const rootPackageJson = readJsonTemplate("saas", "package.json.hbs");
  expect(rootPackageJson).toMatchObject({
    scripts: expect.objectContaining({
      "contract:check": expect.stringMatching(
        /^pnpm contract:client && pnpm --filter \{\{scope\}\}\/provider-rpc typecheck$/,
      ),
      "contract:snapshot": expect.stringMatching(
        /^NODE_PATH=\.\/node_modules croco contracts check[\s\S]*--strict-schemas[\s\S]*--json --out contract-graph\.snapshot\.json$/,
      ),
      "contract:diff": expect.stringMatching(
        /^NODE_PATH=\.\/node_modules croco contracts diff --baseline contract-graph\.snapshot\.json[\s\S]*--controllers[\s\S]*--strict-schemas$/,
      ),
      "contract:coverage": expect.stringMatching(
        /^NODE_PATH=\.\/node_modules croco contracts check[\s\S]*--strict-schemas[\s\S]*--json --out contract-graph\.coverage\.json$/,
      ),
      "project-map:write": expect.stringMatching(
        /^NODE_PATH=\.\/node_modules croco project map[\s\S]*--runtime-policy croco-runtime-policy\.manifest\.json[\s\S]*--provider-profile croco-saas-profile\.manifest\.json[\s\S]*--out croco\.project-map\.json --manifest-bundle \.croco\/manifest$/,
      ),
      "project-map:check": expect.stringMatching(
        /^NODE_PATH=\.\/node_modules croco project map[\s\S]*--runtime-policy croco-runtime-policy\.manifest\.json[\s\S]*--provider-profile croco-saas-profile\.manifest\.json[\s\S]*--check --manifest croco\.project-map\.json --manifest-bundle \.croco\/manifest$/,
      ),
      "contract:verify": expect.stringMatching(
        /^pnpm contract:diff && pnpm contract:coverage && pnpm project-map:write && pnpm project-map:check && pnpm contract:openapi && pnpm contract:client && pnpm --filter \{\{scope\}\}\/provider-rpc typecheck$/,
      ),
      "ci:contracts": "pnpm contract:verify",
      "di:graph": "pnpm --filter {{scope}}/api-server di:graph",
      "di:check": "NODE_PATH=./node_modules croco di check .croco/build/di-graph.manifest.json",
      "di:assert": "node scripts/assert-di-graph.mjs .croco/build/di-graph.manifest.json",
      doctor: "NODE_PATH=./node_modules croco doctor --json",
      "di:verify": expect.stringMatching(
        /^pnpm di:graph && pnpm di:check && pnpm di:assert && pnpm project-map:write && pnpm project-map:check && pnpm doctor$/,
      ),
      "contract:client": expect.stringMatching(
        /^NODE_PATH=\.\/node_modules node \.\/node_modules\/@croco\/rpc-codegen\/dist\/cli\.js[\s\S]*--strict-schemas[\s\S]*--out[\s\S]*--manifest-bundle \.croco\/manifest$/,
      ),
      "contract:openapi": expect.stringMatching(
        /^pnpm contract:check && NODE_PATH=\.\/node_modules croco-openapi-spec[\s\S]*--strict-schemas[\s\S]*--out openapi\.json[\s\S]*--manifest-bundle \.croco\/manifest$/,
      ),
      "demo:seed": expect.any(String),
      "profile:check": "pnpm --filter {{scope}}/api-server profile:check",
      "architecture-policy:check":
        "NODE_PATH=./node_modules croco architecture-policy check --manifest croco.arch.json",
      "runtime-policy:check":
        "NODE_PATH=./node_modules croco runtime-policy check --manifest croco-runtime-policy.manifest.json",
      "profile:smoke:real": "pnpm --filter {{scope}}/api-server profile:smoke:real",
      "demo:smoke": expect.stringMatching(
        /profile:check[\s\S]*architecture-policy:check[\s\S]*runtime-policy:check[\s\S]*contract:check[\s\S]*api-server demo:smoke[\s\S]*api-server ops:smoke[\s\S]*api-server jobs:smoke/,
      ),
      "ops:smoke": "pnpm --filter {{scope}}/api-server ops:smoke",
      "jobs:smoke": "pnpm --filter {{scope}}/api-server jobs:smoke",
      "failure-drill:smoke": "pnpm --filter {{scope}}/api-server failure-drill:smoke",
      "failure-drill:integration": "pnpm --filter {{scope}}/api-server failure-drill:integration",
      typecheck: "turbo typecheck",
      build: "turbo build",
      test: "turbo test",
    }),
    devDependencies: expect.objectContaining({
      "@croco/cli": "workspace:*",
      "@croco/openapi-spec": "workspace:*",
      "@croco/rpc-codegen": "workspace:*",
    }),
  });

  const apiPackageJson = readJsonTemplate("saas", "apps", "api-server", "package.json.hbs");
  expect(apiPackageJson).toMatchObject({
    scripts: expect.objectContaining({
      "di:graph": GENERATED_API_DI_GRAPH_SCRIPT,
      "demo:seed": "tsx src/demo/seed.ts",
      "demo:smoke": "tsx src/demo/smoke.ts",
      "ops:smoke": "tsx src/demo/ops-smoke.ts",
      "jobs:smoke": "tsx src/demo/jobs-smoke.ts",
      "failure-drill:smoke": "tsx src/demo/failure-drill-smoke.ts",
      "failure-drill:integration": "tsx src/provider-profile-check.ts --mode=real-provider",
      "profile:check": "tsx src/provider-profile-check.ts --mode=manifest",
      "profile:smoke:real": "tsx src/provider-profile-check.ts --mode=real-provider",
      test: "vitest run",
    }),
    dependencies: expect.objectContaining({
      "@croco/tenant-core": "workspace:*",
      "@croco/auth-core": "workspace:*",
      "@croco/access-core": "workspace:*",
      "@croco/billing-core": "workspace:*",
      "@croco/metering-core": "workspace:*",
      "@croco/entitlements-core": "workspace:*",
      "@croco/execution-core": "workspace:*",
      "@croco/health-core": "workspace:*",
      "@croco/framework-context": "workspace:*",
      "@croco/lifecycle-core": "workspace:*",
      "@croco/diagnostics-core": "workspace:*",
      "@croco/llm-core": "workspace:*",
      "@croco/llm-metering": "workspace:*",
      "@croco/problems-core": "workspace:*",
      "@croco/protocols-rest": "workspace:*",
      "@croco/ratelimit-core": "workspace:*",
      "@croco/telemetry-api": "workspace:*",
      "@croco/telemetry-sdk-node": "workspace:*",
      "@croco/transports-http": "workspace:*",
    }),
    devDependencies: expect.objectContaining({
      "@croco/cli": "workspace:*",
      "@croco/testing": "workspace:*",
      "cross-env": "^10.1.0",
      typedi: "^0.10.0",
    }),
  });
  expect(apiPackageJson.dependencies).not.toHaveProperty("@croco/testing");
  const rpcPackageJson = readJsonTemplate(
    "saas",
    "libs",
    "shared",
    "provider-rpc",
    "package.json.hbs",
  );
  expect(rpcPackageJson).toMatchObject({
    main: "./src/index.ts",
    types: "./src/index.ts",
    dependencies: expect.objectContaining({
      "@croco/problems-core": "workspace:*",
    }),
  });
  checkFileContains("saas", ["apps", "api-server", "src", "index.ts"], /TelemetryRuntime/);
  checkFileContains("saas", ["apps", "api-server", "src", "saasDemo.ts"], /runSaasDemoFlow/);
  checkFileContains("saas", ["apps", "api-server", "src", "saasDemo.ts"], /EntitlementManager/);
  checkFileContains("saas", ["apps", "api-server", "src", "saasDemo.ts"], /LlmService/);
  checkFileContains("saas", ["apps", "api-server", "src", "saasDemo.ts"], /LlmMeteringService/);
  checkFileContains("saas", ["apps", "api-server", "src", "saasDemo.ts"], /BillingService/);
  checkFileContains("saas", ["apps", "api-server", "src", "saasDemo.ts"], /SeatLimitChecker/);
  checkFileContains(
    "saas",
    ["apps", "api-server", "src", "providerProfiles.ts"],
    /drizzle-polar-upstash/,
  );
  checkFileContains(
    "saas",
    ["apps", "api-server", "src", "providerProfiles.ts"],
    /saas-node-postgres/,
  );
  checkFileContains(
    "saas",
    ["apps", "api-server", "src", "provider-profile-check.ts"],
    /CROCO_SAAS_PROFILE_ENV_MISSING/,
  );
  checkFileContains(
    "saas",
    ["apps", "api-server", "src", "provider-profile-check.ts"],
    /CROCO_SAAS_PROFILE_PACKAGE_MISSING/,
  );
  checkFileContains(
    "saas",
    ["apps", "api-server", "src", "provider-profile-check.ts"],
    /generatedTenantModelManifest/,
  );
  checkFileContains(
    "saas",
    ["apps", "api-server", "src", "provider-profile-check.ts"],
    /CROCO_TENANT_MODEL_COMPATIBILITY_FAILED/,
  );
  checkFileContains(
    "saas",
    ["apps", "api-server", "src", "provider-profile-check.ts"],
    /croco-tenant-model\.manifest\.json/,
  );
  checkFileContains("saas", ["README.md.hbs"], /SAAS_DEMO_ENDPOINTS_ENABLED=true pnpm --filter/);
  checkFileContains("saas", ["README.md.hbs"], /croco-saas-profile\.manifest\.json/);
  checkFileContains("saas", ["README.md.hbs"], /croco-tenant-model\.manifest\.json/);
  checkFileContains("saas", ["README.md.hbs"], /tenant-model-playbook\.md/);
  checkFileContains("saas", ["README.md.hbs"], /@croco\/billing-polar/);
  checkFileContains("saas", ["apps", "api-server", "src", "saasDemo.ts"], /billing-sync/);
  checkFileContains("saas", ["apps", "api-server", "src", "saasDemo.ts"], /LifecycleRuleEvaluator/);
  checkFileContains("saas", ["apps", "api-server", "src", "saasDemo.ts"], /cs\.follow_up/);
  checkFileContains("saas", ["apps", "api-server", "src", "saasDemo.ts"], /EventBusStats/);
  checkFileContains(
    "saas",
    ["apps", "api-server", "src", "app.ts"],
    /defaultSaasRuntime\.diagnosticsCollector\.getProviders/,
  );
  checkFileContains("saas", ["apps", "api-server", "src", "app.ts"], /rateLimitHttpMiddleware/);
  checkFileContains(
    "saas",
    ["apps", "api-server", "src", "app.ts"],
    /OPERATIONAL_RATE_LIMIT_BYPASS_PATHS/,
  );
  checkFileContains(
    "saas",
    ["apps", "api-server", "src", "controllers", "OperationsController.ts"],
    /\/diagnostics/,
  );
  checkFileContains(
    "saas",
    ["apps", "api-server", "src", "controllers", "JobsController.ts"],
    /\/ops\/jobs/,
  );
  checkFileContains("saas", ["apps", "api-server", "src", "demo", "ops-smoke.ts"], /runOpsCheck/);
  checkFileContains("saas", ["apps", "api-server", "src", "demo", "jobs-smoke.ts"], /runJobsList/);
  checkFileContains(
    "saas",
    ["apps", "api-server", "src", "demo", "jobs-smoke.ts"],
    /@croco\/cli\/jobs/,
  );
  checkFileContains(
    "saas",
    ["apps", "api-server", "src", "demo", "jobs-smoke.ts"],
    /replayExecution\.idempotencyKey/,
  );
  checkFileContains(
    "saas",
    ["apps", "api-server", "src", "demo", "failure-drill-smoke.ts"],
    /createFailureDrillCatalog/,
  );
  checkFileContains(
    "saas",
    ["apps", "api-server", "src", "demo", "failure-drill-smoke.ts"],
    /assertSaasSmokeContract/,
  );
  checkFileContains(
    "saas",
    ["apps", "api-server", "src", "demo", "failure-drill-smoke.ts"],
    /llm-metering\/quota-exceeded/,
  );
  checkFileContains(
    "saas",
    ["apps", "api-server", "src", "demo", "ops-smoke.ts"],
    /@croco\/cli\/ops/,
  );
  checkFileContains(
    "saas",
    ["apps", "api-server", "src", "demo", "ops-smoke.ts"],
    /Expected unauthenticated diagnostics to return 403/,
  );
}

function checkAiSaasStructure() {
  checkFileExists("ai-saas", "package.json.hbs");
  checkFileExists("ai-saas", "README.md.hbs");
  checkFileExists("ai-saas", "apps", "api-server", "package.json.hbs");
  checkFileExists("ai-saas", "apps", "api-server", "src", "aiSaas.ts");
  checkFileExists("ai-saas", "apps", "api-server", "src", "aiProblems.ts");
  checkFileExists("ai-saas", "apps", "api-server", "src", "controllers", "AiController.ts");
  checkFileExists("ai-saas", "apps", "api-server", "src", "controllers", "aiSchemas.ts");
  checkFileExists("ai-saas", "apps", "api-server", "src", "demo", "ai-smoke.ts");
  checkFileExists("ai-saas", "apps", "api-server", "src", "demo", "aiSmokeContract.ts");
  checkFileExists("ai-saas", "apps", "api-server", "src", "tests", "AiSaas.spec.ts");

  const rootPackageJson = readJsonTemplate("ai-saas", "package.json.hbs");
  expect(rootPackageJson).toMatchObject({
    scripts: expect.objectContaining({
      "ai:smoke": "pnpm --filter {{scope}}/api-server ai:smoke",
      "demo:smoke": expect.stringMatching(/api-server ai:smoke$/),
      "failure-drill:smoke": "pnpm --filter {{scope}}/api-server failure-drill:smoke",
      "failure-drill:integration": "pnpm --filter {{scope}}/api-server failure-drill:integration",
      "contract:coverage": expect.stringMatching(
        /--strict-schemas[\s\S]*contract-graph\.coverage\.json/,
      ),
      "project-map:write": expect.stringMatching(
        /^NODE_PATH=\.\/node_modules croco project map[\s\S]*--out croco\.project-map\.json --manifest-bundle \.croco\/manifest$/,
      ),
      "project-map:check": expect.stringMatching(
        /^NODE_PATH=\.\/node_modules croco project map[\s\S]*--check --manifest croco\.project-map\.json --manifest-bundle \.croco\/manifest$/,
      ),
      "contract:verify": expect.stringMatching(
        /^pnpm contract:diff && pnpm contract:coverage && pnpm project-map:write && pnpm project-map:check/,
      ),
      "ci:contracts": "pnpm contract:verify",
      "di:graph": "pnpm --filter {{scope}}/api-server di:graph",
      "di:check": "NODE_PATH=./node_modules croco di check .croco/build/di-graph.manifest.json",
      "di:assert": "node scripts/assert-di-graph.mjs .croco/build/di-graph.manifest.json",
      doctor: "NODE_PATH=./node_modules croco doctor --json",
      "di:verify": expect.stringMatching(
        /^pnpm di:graph && pnpm di:check && pnpm di:assert && pnpm project-map:write && pnpm project-map:check && pnpm doctor$/,
      ),
      "contract:openapi": expect.stringMatching(
        /--strict-schemas[\s\S]*AI SaaS API[\s\S]*--manifest-bundle \.croco\/manifest$/,
      ),
    }),
  });

  const apiPackageJson = readJsonTemplate("ai-saas", "apps", "api-server", "package.json.hbs");
  expect(apiPackageJson).toMatchObject({
    scripts: expect.objectContaining({
      "di:graph": GENERATED_API_DI_GRAPH_SCRIPT,
      "ai:smoke": "tsx src/demo/ai-smoke.ts",
      "ops:smoke": "tsx src/demo/ops-smoke.ts",
      "failure-drill:smoke": "tsx src/demo/failure-drill-smoke.ts",
      "failure-drill:integration": "tsx src/provider-profile-check.ts --mode=real-provider",
      test: "vitest run",
    }),
    dependencies: expect.objectContaining({
      "@croco/framework-context": "workspace:*",
      "@croco/lifecycle-core": "workspace:*",
      "@croco/llm-core": "workspace:*",
      "@croco/llm-metering": "workspace:*",
      "@croco/metering-core": "workspace:*",
      "@croco/telemetry-api": "workspace:*",
      "@croco/tenant-core": "workspace:*",
    }),
    devDependencies: expect.objectContaining({
      "@croco/testing": "workspace:*",
      "cross-env": "^10.1.0",
    }),
  });
  expect(apiPackageJson.dependencies).not.toHaveProperty("@croco/testing");

  checkFileContains("ai-saas", ["apps", "api-server", "src", "app.ts.hbs"], /AiController/);
  checkFileContains("ai-saas", ["apps", "api-server", "src", "aiSaas.ts"], /PROMPT_TOKENS/);
  checkFileContains("ai-saas", ["apps", "api-server", "src", "aiSaas.ts"], /COST_USD/);
  checkFileContains("ai-saas", ["apps", "api-server", "src", "aiSaas.ts"], /buildAiIdempotencyKey/);
  checkFileContains(
    "ai-saas",
    ["apps", "api-server", "src", "demo", "aiSmokeContract.ts"],
    /rawPromptStored/,
  );
  checkFileContains("ai-saas", ["README.md.hbs"], /OPENAI_API_KEY/);
  checkFileContains("ai-saas", ["README.md.hbs"], /ANTHROPIC_API_KEY/);
  checkFileContains("ai-saas", ["README.md.hbs"], /Do not expose provider API keys/);
}

describe("GraphQL addon templates", () => {
  it("wires contract snapshot scripts into standalone and Next.js GraphQL apps", () => {
    const standalonePackageJson = readJsonTemplate(
      "addons/graphql-standalone",
      "apps",
      "graphql-api",
      "package.json.hbs",
    );
    expect(standalonePackageJson).toMatchObject({
      scripts: expect.objectContaining({
        build: "pnpm contract:check && tsup src/index.ts --format cjs --clean",
        "contract:check": "tsx src/graphql-contract.ts --check",
        "contract:snapshot": "tsx src/graphql-contract.ts --write",
        typecheck: "pnpm contract:check && tsc --noEmit",
      }),
      dependencies: expect.objectContaining({
        "@croco/protocols-graphql": "workspace:*",
      }),
    });
    checkFileExists(
      "addons/graphql-standalone",
      "apps",
      "graphql-api",
      "graphql-contract.snapshot.json",
    );
    checkFileContains(
      "addons/graphql-standalone",
      ["apps", "graphql-api", "src", "graphql-contract.ts"],
      /createGraphQLContractSnapshot/,
    );

    const nextjsPackageJson = readJsonTemplate(
      "addons/graphql-nextjs",
      "apps",
      "web",
      "package.json.hbs",
    );
    expect(nextjsPackageJson).toMatchObject({
      scripts: expect.objectContaining({
        build: "pnpm contract:check && next build",
        "contract:check": "tsx src/server/graphql-contract.ts --check",
        "contract:snapshot": "tsx src/server/graphql-contract.ts --write",
        typecheck: "pnpm contract:check && tsc --noEmit",
      }),
      dependencies: expect.objectContaining({
        "@croco/protocols-graphql": "workspace:*",
      }),
      devDependencies: expect.objectContaining({
        tsx: "^4.20.3",
      }),
    });
    const nextjsTsconfig = readJsonTemplate(
      "addons/graphql-nextjs",
      "apps",
      "web",
      "tsconfig.json.hbs",
    );
    expect(nextjsTsconfig).toMatchObject({
      compilerOptions: expect.objectContaining({
        jsx: "preserve",
        module: "esnext",
        moduleResolution: "bundler",
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
      }),
    });
    checkFileExists("addons/graphql-nextjs", "apps", "web", "graphql-contract.snapshot.json");
    checkFileContains(
      "addons/graphql-nextjs",
      ["apps", "web", "src", "server", "graphql-contract.ts"],
      /diffGraphQLContractSnapshots/,
    );
  });
});

describe("Web Meta Vite fullstack addon templates", () => {
  it("keeps the API worker Wrangler build non-recursive", () => {
    checkWebMetaViteFullstackAddonStructure();
  });
});

describe("Base preset README templates", () => {
  it("documents the blank preset first-run loop", () => {
    checkFileExists("blank", "README.md.hbs");
    checkFileContains("blank", ["README.md.hbs"], /pnpm install/);
    checkFileContains("blank", ["README.md.hbs"], /pnpm dev/);
    checkFileContains("blank", ["README.md.hbs"], /pnpm typecheck/);
    checkFileContains("blank", ["README.md.hbs"], /expected success state/);
    checkFileContains("blank", ["README.md.hbs"], /Recovery/);
  });

  it("documents the shared DDD preset first-run loop", () => {
    checkFileExists("base-ddd", "README.md.hbs");
    checkFileContains("base-ddd", ["README.md.hbs"], /ddd-api/);
    checkFileContains("base-ddd", ["README.md.hbs"], /ddd-fullstack/);
    checkFileContains("base-ddd", ["README.md.hbs"], /legacy compatibility name/);
    checkFileContains("base-ddd", ["README.md.hbs"], /@croco\/meta-vite/);
    checkFileContains("base-ddd", ["README.md.hbs"], /pnpm install/);
    checkFileContains("base-ddd", ["README.md.hbs"], /pnpm dev/);
    checkFileContains("base-ddd", ["README.md.hbs"], /pnpm build/);
    checkFileContains("base-ddd", ["README.md.hbs"], /expected success state/);
    checkFileContains("base-ddd", ["README.md.hbs"], /Recovery/);
  });

  it("uses pnpm's supported build-script allowlist key in generated workspaces", () => {
    for (const template of ["blank", "ssr-lambda"]) {
      checkFileContains(template, ["pnpm-workspace.yaml"], /^onlyBuiltDependencies:/m);
      checkFileDoesNotContain(template, ["pnpm-workspace.yaml"], /^onlyBuiltDeps:/m);
    }
  });
});

describe.each(["spa-be-split", "saas", "ai-saas", "admin-console"])(
  "Shipped template: %s",
  (template) => {
    it("should have required structure", () => {
      if (template === "spa-be-split") {
        checkSpaBeSplitStructure();
        return;
      }

      if (template === "saas") {
        checkSaasStructure();
        return;
      }

      if (template === "ai-saas") {
        checkAiSaasStructure();
        return;
      }

      checkAdminConsoleStructure();
    });
  },
);

describe.each(["ssr-lambda", "container-fullstack"])("Compatibility fixture: %s", (template) => {
  it("should have required structure", () => {
    if (template === "ssr-lambda") {
      checkSsrLambdaStructure();
      return;
    }

    checkContainerFullstackStructure();
  });
});
