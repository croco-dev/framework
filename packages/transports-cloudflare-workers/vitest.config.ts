import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const currentDir = dirname(fileURLToPath(import.meta.url));
const workspacePackages = [
  "diagnostics-core",
  "events-core",
  "framework-config",
  "framework-context",
  "framework-logger",
  "health-core",
  "problems-core",
  "protocols-core",
  "protocols-rest",
  "ratelimit-core",
  "transports-http",
];
const workspaceAliases = workspacePackages.flatMap((packageName) => [
  {
    find: `@croco/${packageName}/src`,
    replacement: resolve(currentDir, `../${packageName}/src`),
  },
  {
    find: `@croco/${packageName}`,
    replacement: resolve(currentDir, `../${packageName}/src/index.ts`),
  },
]);

export default defineConfig({
  resolve: {
    alias: workspaceAliases,
  },
  test: {
    environment: "node",
    include: ["src/**/*.spec.ts"],
  },
});
