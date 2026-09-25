import assert from "node:assert/strict";
import { createRequire, registerHooks } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
const packageRoot = fileURLToPath(new URL("../", import.meta.url));

registerHooks({
  resolve(specifier, context, nextResolve) {
    const dependency = /^@croco\/([^/]+)$/.exec(specifier);
    if (!dependency || dependency[1] === "admin-core") return nextResolve(specifier, context);

    const isRequire = context.conditions.includes("require");
    const file = resolve(
      repositoryRoot,
      "packages",
      dependency[1],
      "dist",
      isRequire ? "index.js" : "index.mjs",
    );
    return nextResolve(isRequire ? file : pathToFileURL(file).href, context);
  },
});

function verifyEntrypoints(root, validation, operations) {
  assert.equal(root.FactHistoryInputProblem, validation.FactHistoryInputProblem);
  assert.throws(
    () => validation.validateFactHistoryComparison({ limit: 0 }),
    (error) =>
      error instanceof root.FactHistoryInputProblem &&
      error.code === "admin-core/fact-history-input",
  );
  assert.throws(
    () => operations.createFactHistoryOperations({}, ""),
    (error) =>
      error instanceof root.FactHistoryInputProblem &&
      error.code === "admin-core/fact-history-input",
  );
}

const requirePackage = createRequire(resolve(packageRoot, "package.json"));
verifyEntrypoints(
  requirePackage("@croco/admin-core"),
  requirePackage("@croco/admin-core/fact-history-validation"),
  requirePackage("@croco/admin-core/fact-history-operations"),
);

verifyEntrypoints(
  await import(pathToFileURL(resolve(packageRoot, "dist/index.mjs")).href),
  await import(pathToFileURL(resolve(packageRoot, "dist/fact-history-validation.mjs")).href),
  await import(pathToFileURL(resolve(packageRoot, "dist/fact-history-operations.mjs")).href),
);
