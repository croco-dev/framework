const { resolve, dirname } = require("node:path");
const { pathToFileURL } = require("node:url");
const { compileRoutes } = require("../dist/compiler.js");

const scriptDir = dirname(__filename);
const projectRoot = resolve(scriptDir, "..");
const generatedFixtureDir = resolve(projectRoot, ".croco/build/fixtures");
const generatedFixturePath = resolve(generatedFixtureDir, "SampleController.js");
const sampleControllerSourcePath = resolve(
  projectRoot,
  "src/__tests__/fixtures/SampleController.ts",
);

const controllerPaths = process.argv
  .slice(2)
  .map((controllerPath) => pathToFileURL(resolve(controllerPath)).href);
const sourcePaths = [];

async function buildGeneratedControllerFixture() {
  const { build } = await import("tsup");

  await build({
    entry: [sampleControllerSourcePath.replaceAll("\\", "/")],
    format: ["cjs"],
    outDir: generatedFixtureDir,
    clean: true,
    dts: false,
    silent: true,
    external: ["reflect-metadata"],
    noExternal: [
      "@croco/framework-context",
      "@croco/problems-core",
      "@croco/protocols-core",
      "@croco/protocols-rest",
    ],
  });
}

async function main() {
  try {
    if (controllerPaths.length === 0) {
      await buildGeneratedControllerFixture();
      controllerPaths.push(pathToFileURL(generatedFixturePath).href);
      sourcePaths.push(
        pathToFileURL(sampleControllerSourcePath).href,
        pathToFileURL(resolve(projectRoot, "src/__tests__/fixtures/IntentMapModule.ts")).href,
      );
    }

    await compileRoutes({
      controllerPaths,
      ...(sourcePaths.length > 0 ? { sourcePaths } : {}),
      outputDir: projectRoot,
    });
    console.log(
      "✓ routes.mjs, route-registration-table.json, intent-map.json, and framework-manifest.json generated at .croco/build",
    );
  } catch (err) {
    console.error("Failed to generate routes.mjs:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();
