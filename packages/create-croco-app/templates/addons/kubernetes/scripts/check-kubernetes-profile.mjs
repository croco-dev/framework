import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const manifestPath = new URL("croco-infrastructure-profile.manifest.json", root);
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
assert.equal(manifest.schemaVersion, "croco.infrastructure-profile/v1");
assert.equal(manifest.profile, "kubernetes-node-api");
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
      `Profile drift: ${file.path}. Review changes before pnpm k8s:lock.`,
    );
}
if (adopt) {
  // Adoption invalidates old verification claims; it never certifies a cluster.
  manifest.verification = {
    schema: "not-run",
    nodeHost: "not-run",
    liveCluster: "not-verified",
    certification: "not-certified",
  };
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}
console.log(
  adopt
    ? "Reviewed profile hashes recorded; verification must run again."
    : "Kubernetes profile hashes match. This is not schema or live-cluster validation.",
);
