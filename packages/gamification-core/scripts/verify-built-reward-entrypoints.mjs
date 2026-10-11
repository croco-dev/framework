import assert from "node:assert/strict";
import { createRequire, registerHooks } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
const packageRoot = fileURLToPath(new URL("../", import.meta.url));

registerHooks({
  resolve(specifier, context, nextResolve) {
    const dependency = /^@croco\/([^/]+)$/.exec(specifier);
    if (!dependency || dependency[1] === "gamification-core")
      return nextResolve(specifier, context);
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

async function verifyEntrypoints(root, contracts) {
  for (const name of [
    "InvalidRewardPolicyProblem",
    "RewardAccessDeniedProblem",
    "RewardEvidenceInvalidProblem",
    "RewardConflictProblem",
    "RewardUnavailableProblem",
    "assertRewardPolicy",
    "assertRewardScope",
    "selectReward",
  ]) {
    assert.equal(root[name], contracts[name], `${name} must share runtime identity`);
  }
  for (const entrypoint of [root, contracts]) {
    assert.throws(
      () => entrypoint.assertRewardScope({}),
      (error) =>
        error instanceof root.RewardAccessDeniedProblem &&
        error instanceof contracts.RewardAccessDeniedProblem,
    );
    assert.throws(
      () => entrypoint.assertRewardPolicy({}),
      (error) =>
        error instanceof root.InvalidRewardPolicyProblem &&
        error instanceof contracts.InvalidRewardPolicyProblem,
    );
  }
  const service = new root.RewardService(
    {},
    { verify: async () => false },
    {
      authorizeSubject: async () => false,
      authorizePublication: async () => false,
    },
  );
  await assert.rejects(
    service.getAccount({ appId: "app", environmentId: "test", tenantId: "tenant" }, "member"),
    (error) =>
      error instanceof root.RewardAccessDeniedProblem &&
      error instanceof contracts.RewardAccessDeniedProblem,
  );
  await assert.rejects(
    service.getAccount({}, "member"),
    (error) =>
      error instanceof root.RewardAccessDeniedProblem &&
      error instanceof contracts.RewardAccessDeniedProblem,
  );
}

const requirePackage = createRequire(resolve(packageRoot, "package.json"));
await verifyEntrypoints(
  requirePackage("@croco/gamification-core"),
  requirePackage("@croco/gamification-core/reward-contracts"),
);
await verifyEntrypoints(
  await import(pathToFileURL(resolve(packageRoot, "dist/index.mjs")).href),
  await import(pathToFileURL(resolve(packageRoot, "dist/reward-contracts.mjs")).href),
);
