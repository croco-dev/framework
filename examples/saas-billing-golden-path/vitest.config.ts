import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const currentDir = dirname(fileURLToPath(import.meta.url));
const packageDir = resolve(currentDir, "../..");
const workspacePackages = [
  "diagnostics-core",
  "events-core",
  "events-inmemory",
  "framework-context",
  "framework-logger",
  "health-core",
  "llm-core",
  "openapi-spec",
  "problems-core",
  "protocols-core",
  "protocols-rest",
  "ratelimit-core",
  "retry-core",
  "storage-core",
  "telemetry-api",
  "testing",
  "transports-http",
  "tx-core",
];

const workspaceAliases = workspacePackages.flatMap((packageName) => [
  {
    find: `@croco/${packageName}/src`,
    replacement: resolve(packageDir, `packages/${packageName}/src`),
  },
  {
    find: `@croco/${packageName}`,
    replacement: resolve(packageDir, `packages/${packageName}/src/index.ts`),
  },
]);

export default defineConfig({
  resolve: {
    alias: workspaceAliases,
  },
  test: {
    environment: "node",
    include: ["src/tests/**/*.spec.ts"],
  },
});
