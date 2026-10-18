import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const manifestPath = new URL("croco-infrastructure-profile.manifest.json", root);
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
assert.equal(manifest.schemaVersion, "croco.infrastructure-profile/v1");
assert.equal(manifest.profile, "lambda-api");
const api = JSON.parse(readFileSync(new URL("apps/api-server/package.json", root), "utf8"));
assert.equal(api.main, "./dist/lambda.js", "Lambda package entry drift");
assert.deepEqual(api.files, ["dist"], "Lambda package file selection drift");
const project = JSON.parse(readFileSync(new URL("package.json", root), "utf8"));
for (const [name, command] of Object.entries({
  "lambda:package": "node scripts/package-lambda.mjs",
  "lambda:check": "node scripts/check-lambda-profile.mjs",
  "lambda:lock": "node scripts/check-lambda-profile.mjs --write",
  "lambda:smoke": "node scripts/smoke-lambda.mjs",
}))
  assert.equal(project.scripts[name], command, `Lambda command drift: ${name}`);
assert.equal(api.scripts.build, "tsup --config tsup.config.ts", "Lambda build command drift");
const adopt = process.argv.slice(2).includes("--write");
for (const file of manifest.files) {
  const path = new URL(file.path, root);
  assert.ok(fileURLToPath(path).startsWith(fileURLToPath(root)), "Profile path escapes project");
  assert.ok(
    existsSync(path),
    `Profile file missing: ${file.path}. Restore it before checking or adoption.`,
  );
  const actual = createHash("sha256").update(readFileSync(path)).digest("hex");
  if (adopt) file.sha256 = actual;
  else
    assert.equal(
      actual,
      file.sha256,
      `Profile drift: ${file.path}. Review changes before pnpm lambda:lock.`,
    );
}
if (adopt) {
  // Adoption invalidates old verification claims; it never certifies AWS.
  manifest.verification = {
    schema: "not-run",
    invocation: "not-run",
    liveAws: "not-verified",
    certification: "not-certified",
  };
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}
console.log(
  adopt
    ? "Reviewed profile hashes recorded; verification must run again."
    : "Lambda profile hashes match. This is not schema or live-AWS validation.",
);
