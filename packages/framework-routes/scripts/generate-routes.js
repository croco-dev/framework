const { resolve, dirname } = require("node:path");
const { pathToFileURL } = require("node:url");
const { compileRoutes } = require("../dist/compiler.js");

const scriptDir = dirname(__filename);
const projectRoot = resolve(scriptDir, "..");

const controllerPaths = process.argv
  .slice(2)
  .map((controllerPath) => pathToFileURL(resolve(controllerPath)).href);
const sourcePaths = [];
if (controllerPaths.length === 0) {
  controllerPaths.push(
    pathToFileURL(resolve(projectRoot, "dist/__tests__/fixtures/SampleController.js")).href,
  );
  sourcePaths.push(
    resolve(projectRoot, "src/__tests__/fixtures/SampleController.ts"),
    resolve(projectRoot, "src/__tests__/fixtures/IntentMapModule.ts"),
  );
}

async function main() {
  try {
    await compileRoutes({
      controllerPaths,
      ...(sourcePaths.length > 0 ? { sourcePaths } : {}),
      outputDir: projectRoot,
    });
    console.log(
      "✓ routes.js, route-registration-table.json, and intent-map.json generated at .croco/build",
    );
  } catch (err) {
    console.error("Failed to generate routes.js:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();
