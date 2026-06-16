import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const TEMPLATES_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../templates");

function templatePath(template: string, ...paths: string[]): string {
  return join(TEMPLATES_DIR, template, ...paths);
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
  checkFileExists("spa-be-split", "apps", "api-server", "package.json.hbs");
  readJsonTemplate("spa-be-split", "apps", "api-server", "package.json.hbs");
  checkFileContains(
    "spa-be-split",
    ["apps", "api-server", "src", "app.ts"],
    /@croco\/transports-http/,
  );
  checkFileContains("spa-be-split", ["apps", "api-server", "src", "index.ts"], /createCrocoApp/);
  checkFileExists("spa-be-split", "apps", "console-web", "package.json.hbs");
  checkFileExists("spa-be-split", "apps", "console-web", "src", "main.tsx");
  checkFileExists("spa-be-split", "apps", "console-web", "vite.config.ts.hbs");

  for (const directory of ["service", "domain", "datasource", "feature", "page", "ui"]) {
    checkDirectoryExists("spa-be-split", "libs", "sample-domain", directory);
  }

  checkFileExists("spa-be-split", "libs", "shared", "provider-rpc", "package.json.hbs");
  checkFileExists("spa-be-split", "libs", "shared", "provider-rpc", "tsconfig.json.hbs");

  const rootPackageJson = readJsonTemplate("spa-be-split", "package.json.hbs");
  expect(rootPackageJson).toMatchObject({
    scripts: expect.objectContaining({
      "dev:api": expect.any(String),
      "dev:web": expect.any(String),
      "contract:check": expect.stringMatching(/croco-rpc-codegen[\s\S]*--check/),
      "contract:openapi": expect.stringMatching(/^pnpm contract:check &&[\s\S]*croco-openapi-spec/),
      "contract:client": expect.stringMatching(/^pnpm contract:check &&[\s\S]*croco-rpc-codegen/),
      codegen: expect.any(String),
      test: "turbo test",
    }),
    devDependencies: expect.objectContaining({
      "@croco/openapi-spec": "workspace:*",
      "@croco/rpc-codegen": "workspace:*",
    }),
  });
  const apiPackageJson = readJsonTemplate("spa-be-split", "apps", "api-server", "package.json.hbs");
  expect(apiPackageJson).toMatchObject({
    scripts: expect.objectContaining({
      test: "vitest run",
    }),
    devDependencies: expect.objectContaining({
      "@croco/testing": "workspace:*",
      vitest: expect.any(String),
    }),
    dependencies: expect.objectContaining({
      zod: expect.any(String),
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
    scripts: expect.objectContaining({
      typecheck: "tsc --noEmit",
    }),
    dependencies: expect.objectContaining({
      "@tanstack/react-query": expect.any(String),
    }),
  });
  checkFileContains(
    "spa-be-split",
    ["apps", "api-server", "src", "tests", "app.spec.ts"],
    /createTestingApp/,
  );
  checkFileContains(
    "spa-be-split",
    ["apps", "api-server", "src", "app.ts"],
    /export function createCrocoApp/,
  );
  checkFileContains(
    "spa-be-split",
    ["apps", "api-server", "src", "controllers", "UserController.ts"],
    /@ResponseSchema/,
  );
  checkFileContains(
    "spa-be-split",
    ["apps", "api-server", "src", "controllers", "UserController.ts"],
    /@Body\(createUserInputSchema\)/,
  );
  checkFileExists("spa-be-split", "pnpm-workspace.yaml");
}

function checkSsrLambdaStructure() {
  checkFileExists("ssr-lambda", "apps", "api-server", "package.json.hbs");
  checkFileContains(
    "ssr-lambda",
    ["apps", "api-server", "src", "lambda.ts"],
    /export { lambdaHandler as handler }/,
  );
  checkFileExists("ssr-lambda", "apps", "console-web", "package.json.hbs");

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

function checkContainerFullstackStructure() {
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
  checkFileExists("saas", "apps", "api-server", "src", "inMemoryAdapters.ts");
  checkFileExists("saas", "apps", "api-server", "src", "controllers", "SaasController.ts");
  checkFileExists("saas", "apps", "api-server", "src", "controllers", "OperationsController.ts");
  checkFileExists("saas", "apps", "api-server", "src", "tests", "SaasDemo.spec.ts");
  checkFileExists("saas", "libs", "shared", "provider-rpc", "package.json.hbs");

  const rootPackageJson = readJsonTemplate("saas", "package.json.hbs");
  expect(rootPackageJson).toMatchObject({
    scripts: expect.objectContaining({
      "contract:check": expect.stringMatching(
        /^pnpm contract:client && pnpm --filter \{\{scope\}\}\/provider-rpc typecheck$/,
      ),
      "contract:client": expect.stringMatching(
        /^NODE_PATH=\.\/node_modules node \.\/node_modules\/@croco\/rpc-codegen\/dist\/cli\.js[\s\S]*--out/,
      ),
      "contract:openapi": expect.stringMatching(
        /^pnpm contract:check && NODE_PATH=\.\/node_modules croco-openapi-spec[\s\S]*--out openapi\.json/,
      ),
      "demo:seed": expect.any(String),
      "demo:smoke": expect.stringMatching(/contract:check[\s\S]*api-server demo:smoke/),
      typecheck: "turbo typecheck",
      build: "turbo build",
      test: "turbo test",
    }),
    devDependencies: expect.objectContaining({
      "@croco/openapi-spec": "workspace:*",
      "@croco/rpc-codegen": "workspace:*",
    }),
  });

  const apiPackageJson = readJsonTemplate("saas", "apps", "api-server", "package.json.hbs");
  expect(apiPackageJson).toMatchObject({
    scripts: expect.objectContaining({
      "demo:seed": "tsx src/demo/seed.ts",
      "demo:smoke": "tsx src/demo/smoke.ts",
      test: "vitest run",
    }),
    dependencies: expect.objectContaining({
      "@croco/tenant-core": "workspace:*",
      "@croco/auth-core": "workspace:*",
      "@croco/access-core": "workspace:*",
      "@croco/billing-core": "workspace:*",
      "@croco/metering-core": "workspace:*",
      "@croco/entitlements-core": "workspace:*",
      "@croco/health-core": "workspace:*",
      "@croco/diagnostics-core": "workspace:*",
      "@croco/protocols-rest": "workspace:*",
      "@croco/transports-http": "workspace:*",
    }),
  });
  checkFileContains("saas", ["apps", "api-server", "src", "saasDemo.ts"], /runSaasDemoFlow/);
  checkFileContains("saas", ["apps", "api-server", "src", "saasDemo.ts"], /EntitlementManager/);
  checkFileContains("saas", ["apps", "api-server", "src", "saasDemo.ts"], /BillingService/);
  checkFileContains(
    "saas",
    ["apps", "api-server", "src", "controllers", "OperationsController.ts"],
    /\/diagnostics/,
  );
}

describe.each(["spa-be-split", "ssr-lambda", "container-fullstack", "saas"])(
  "Template: %s",
  (template) => {
    it("should have required structure", () => {
      if (template === "spa-be-split") {
        checkSpaBeSplitStructure();
        return;
      }

      if (template === "ssr-lambda") {
        checkSsrLambdaStructure();
        return;
      }

      if (template === "saas") {
        checkSaasStructure();
        return;
      }

      checkContainerFullstackStructure();
    });
  },
);
