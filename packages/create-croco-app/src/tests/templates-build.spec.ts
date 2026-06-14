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
    ["apps", "api-server", "src", "index.ts"],
    /@croco\/transports-http/,
  );
  checkFileExists("spa-be-split", "apps", "console-web", "package.json.hbs");
  checkFileExists("spa-be-split", "apps", "console-web", "src", "main.tsx");
  checkFileExists("spa-be-split", "apps", "console-web", "vite.config.ts.hbs");

  for (const directory of ["service", "domain", "datasource", "feature", "page", "ui"]) {
    checkDirectoryExists("spa-be-split", "libs", "sample-domain", directory);
  }

  checkFileExists("spa-be-split", "libs", "shared", "provider-rpc", "package.json.hbs");

  const rootPackageJson = readJsonTemplate("spa-be-split", "package.json.hbs");
  expect(rootPackageJson).toMatchObject({
    scripts: expect.objectContaining({
      "dev:api": expect.any(String),
      "dev:web": expect.any(String),
      codegen: expect.any(String),
    }),
  });
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

describe.each(["spa-be-split", "ssr-lambda", "container-fullstack"])("Template: %s", (template) => {
  it("should have required structure", () => {
    if (template === "spa-be-split") {
      checkSpaBeSplitStructure();
      return;
    }

    if (template === "ssr-lambda") {
      checkSsrLambdaStructure();
      return;
    }

    checkContainerFullstackStructure();
  });
});
