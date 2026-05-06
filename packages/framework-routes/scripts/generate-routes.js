const { resolve, dirname } = require('node:path');
const { pathToFileURL } = require('node:url');
const { compileRoutes } = require('../dist/compiler.js');

const scriptDir = dirname(__filename);
const projectRoot = resolve(scriptDir, '..');

const controllerPaths = process.argv.slice(2).map((controllerPath) => pathToFileURL(resolve(controllerPath)).href);
if (controllerPaths.length === 0) {
  controllerPaths.push(pathToFileURL(resolve(projectRoot, 'dist/__tests__/fixtures/SampleController.js')).href);
}

async function main() {
  try {
    await compileRoutes({
      controllerPaths,
      outputDir: projectRoot,
    });
    console.log('✓ routes.js generated at .croco/build/routes.js');
  } catch (err) {
    console.error('Failed to generate routes.js:', err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();
