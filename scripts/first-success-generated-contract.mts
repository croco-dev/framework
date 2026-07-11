import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

type PackageJson = {
  readonly name?: unknown;
  readonly scripts?: Record<string, unknown>;
};

const generatedControllerPaths = [
  "apps/api-server/src/controllers/SaasController.ts",
  "apps/api-server/src/controllers/OperationsController.ts",
] as const;

export function validateGeneratedSaasDocsContract(
  targetDir: string,
  docsContent: string,
): string[] {
  const failures: string[] = [];

  for (const controllerPath of generatedControllerPaths) {
    if (!existsSync(join(targetDir, controllerPath))) {
      failures.push(`generated REST controller is missing: ${controllerPath}`);
    }
    if (!docsContent.includes(controllerPath)) {
      failures.push(`docs missing generated SaaS controller path \`${controllerPath}\``);
    }
  }

  const rootPackageJson = readPackageJson(join(targetDir, "package.json"));
  const apiPackageJson = readPackageJson(join(targetDir, "apps/api-server/package.json"));
  const apiPackageName = typeof apiPackageJson.name === "string" ? apiPackageJson.name : undefined;
  const providerProfiles = readFileSync(
    join(targetDir, "apps/api-server/src/providerProfiles.ts"),
    "utf-8",
  );
  const serverIndex = readFileSync(join(targetDir, "apps/api-server/src/index.ts"), "utf-8");
  const routeSchemas = readFileSync(
    join(targetDir, "apps/api-server/src/controllers/schemas.ts"),
    "utf-8",
  );

  const demoEndpointsEnv = extractRequiredMatch(
    providerProfiles,
    /SAAS_DEMO_ENDPOINTS_ENABLED_ENV\s*=\s*['"]([^'"]+)['"]/,
    "generated demo endpoint environment variable",
    failures,
  );
  const port = extractRequiredMatch(
    serverIndex,
    /Number\(value\s*\?\?\s*(\d+)\)/,
    "generated default HTTP port",
    failures,
  );
  const seedPath = extractRoutePath(routeSchemas, "seedSaasDemoRoute", failures);
  const smokePath = extractRoutePath(routeSchemas, "smokeSaasDemoRoute", failures);
  const healthPath = extractRoutePath(routeSchemas, "healthRoute", failures);

  if (!apiPackageName) {
    failures.push("generated apps/api-server/package.json is missing package name");
  }
  if (!rootPackageJson.scripts?.["contract:check"]) {
    failures.push("generated package.json is missing scripts.contract:check");
  }

  const derivedDocsContracts = [
    apiPackageName && demoEndpointsEnv
      ? `${demoEndpointsEnv}=true pnpm --filter ${apiPackageName} dev`
      : undefined,
    port && seedPath ? `http://localhost:${port}${seedPath}` : undefined,
    port && smokePath ? `http://localhost:${port}${smokePath}` : undefined,
    port && healthPath ? `http://localhost:${port}${healthPath}` : undefined,
    rootPackageJson.scripts?.["contract:check"] ? "pnpm contract:check" : undefined,
  ].filter((contract): contract is string => contract !== undefined);

  for (const contract of derivedDocsContracts) {
    if (!docsContent.includes(contract)) {
      failures.push(`docs missing generated SaaS runtime contract \`${contract}\``);
    }
  }

  return failures;
}

function extractRoutePath(
  content: string,
  routeName: string,
  failures: string[],
): string | undefined {
  const match = new RegExp(
    `export const ${routeName} = defineRouteContract\\(\\{[\\s\\S]*?\\bpath:\\s*['"]([^'"]+)['"]`,
  ).exec(content);

  if (!match?.[1]) {
    failures.push(`generated route contract is missing a path: ${routeName}`);
    return undefined;
  }

  return match[1];
}

function extractRequiredMatch(
  content: string,
  pattern: RegExp,
  label: string,
  failures: string[],
): string | undefined {
  const value = pattern.exec(content)?.[1];
  if (!value) {
    failures.push(`${label} is not inspectable`);
  }
  return value;
}

function readPackageJson(path: string): PackageJson {
  const parsed: unknown = JSON.parse(readFileSync(path, "utf-8"));
  return typeof parsed === "object" && parsed !== null ? (parsed as PackageJson) : {};
}
