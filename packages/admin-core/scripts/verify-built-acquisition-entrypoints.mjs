import assert from "node:assert/strict";
import { createRequire, registerHooks } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
const packageRoot = fileURLToPath(new URL("../", import.meta.url));

registerHooks({
  resolve(specifier, context, nextResolve) {
    const dependency = /^@croco\/([^/]+)(?:\/([^/]+))?$/.exec(specifier);
    if (!dependency || dependency[1] === "admin-core") return nextResolve(specifier, context);

    const isRequire = context.conditions.includes("require");
    const file = resolve(
      repositoryRoot,
      "packages",
      dependency[1],
      "dist",
      `${dependency[2] ?? "index"}.${isRequire ? "js" : "mjs"}`,
    );
    return nextResolve(isRequire ? file : pathToFileURL(file).href, context);
  },
});

async function verify(core, operations) {
  const scope = { app: "test", environment: "test", tenantId: "one" };
  for (const [failure, state] of [
    ["denied", "denied"],
    ["limit", "partial"],
  ]) {
    const service = {
      compare: async () => {
        throw new core.AcquisitionProblem(failure);
      },
    };
    assert.deepEqual(await operations.createAcquisitionOperations(service, scope).compare({}), {
      kind: state,
    });
  }
  const service = {
    compare: async () => {
      throw new core.AcquisitionProblem("persistence");
    },
  };
  await assert.rejects(operations.createAcquisitionOperations(service, scope).compare({}), {
    code: "analytics/acquisition/persistence",
  });
}
const requirePackage = createRequire(resolve(packageRoot, "package.json"));
await verify(
  requirePackage("@croco/analytics-core/acquisition"),
  requirePackage("./dist/acquisition.js"),
);
await verify(
  await import(
    pathToFileURL(resolve(repositoryRoot, "packages/analytics-core/dist/acquisition.mjs")).href
  ),
  await import(pathToFileURL(resolve(packageRoot, "dist/acquisition.mjs")).href),
);
console.log(
  "CJS and ESM acquisition operations preserve denied, bounded and failed lookup results.",
);
