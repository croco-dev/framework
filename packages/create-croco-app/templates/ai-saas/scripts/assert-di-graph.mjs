import { readFileSync } from "node:fs";

const manifestPath = process.argv[2] ?? ".croco/build/di-graph.manifest.json";
let manifest;
try {
  manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(
    `Failed to read or parse DI graph manifest at '${manifestPath}'. Run pnpm di:graph, then follow the DI graph drift recovery steps. Cause: ${message}`,
  );
  process.exit(1);
}

if (
  typeof manifest !== "object" ||
  manifest === null ||
  !Array.isArray(manifest.roots) ||
  manifest.roots.length === 0 ||
  !Array.isArray(manifest.providers) ||
  manifest.providers.length === 0
) {
  console.error("DI graph manifest must include at least one root and provider.");
  process.exit(1);
}
