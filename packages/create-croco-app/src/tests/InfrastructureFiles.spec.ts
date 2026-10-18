import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { stringify } from "yaml";
import { createRuntimeCapabilityManifest } from "@croco/framework-context";
import { validateInfrastructureFiles } from "../infrastructure-files.js";
import type { InfrastructureFilePlan } from "../infrastructure-files.js";
import type { InfrastructureProfile } from "../infrastructure.js";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
function setup(profile: InfrastructureProfile) {
  const root = mkdtempSync(join(tmpdir(), "croco-infra-"));
  roots.push(root);
  const input = JSON.parse(
    readFileSync(new URL(`./fixtures/infrastructure/${profile}.json`, import.meta.url), "utf8"),
  );
  writeFileSync(join(root, "requirements.json"), JSON.stringify(input.requirements));
  writeFileSync(join(root, "artifact.json"), JSON.stringify(input.artifact));
  writeFileSync(
    join(root, "runtime.json"),
    JSON.stringify(createRuntimeCapabilityManifest(input.requirements.runtime)),
  );
  const plan: InfrastructureFilePlan = {
    ...input,
    requirements: "requirements.json",
    artifact: "artifact.json",
    runtimeManifest: "runtime.json",
  };
  return { root, plan, input };
}
it.each(["kubernetes", "aws-lambda", "cloudflare-workers"] as const)(
  "reads real %s JSON artifacts without writing them",
  (profile) => {
    const { root, plan } = setup(profile);
    const before = readFileSync(join(root, "artifact.json"), "utf8");
    expect(validateInfrastructureFiles(root, plan).ok).toBe(true);
    expect(readFileSync(join(root, "artifact.json"), "utf8")).toBe(before);
    writeFileSync(
      join(root, "runtime.json"),
      JSON.stringify({ version: "wrong", platform: "node", capabilities: {} }),
    );
    expect(validateInfrastructureFiles(root, plan).diagnostics).toContainEqual({
      code: "CROCO_INFRA_RUNTIME",
    });
  },
);
it("reads Kubernetes multi-document YAML and rejects parser errors without echoing secret input", () => {
  const { root, plan, input } = setup("kubernetes");
  writeFileSync(
    join(root, "resources.yaml"),
    input.artifact.map((resource: unknown) => stringify(resource)).join("---\n"),
  );
  const yamlPlan = { ...plan, artifact: "resources.yaml" };
  expect(validateInfrastructureFiles(root, yamlPlan).ok).toBe(true);
  writeFileSync(
    join(root, "resources.yaml"),
    stringify({ apiVersion: "v1", kind: "List", items: input.artifact }),
  );
  expect(validateInfrastructureFiles(root, yamlPlan).ok).toBe(true);
  writeFileSync(join(root, "resources.yaml"), "secret: [synthetic-never-print-this");
  const result = validateInfrastructureFiles(root, yamlPlan);
  expect(result.ok).toBe(false);
  expect(JSON.stringify(result)).not.toContain("synthetic-never-print-this");
});
it("reads Wrangler TOML without assuming top-level bindings are inherited by an environment", () => {
  const { root, plan } = setup("cloudflare-workers");
  writeFileSync(
    join(root, "worker.toml"),
    `name = "shop-api"
main = "src/worker.ts"
compatibility_date = "2026-10-01"
[[d1_databases]]
binding = "DB"
database_id = "11111111-2222-3333-4444-555555555555"
database_name = "shop"
[[r2_buckets]]
binding = "FILES"
bucket_name = "files"
[[queues.producers]]
binding = "JOBS"
queue = "jobs"
[[secrets_store_secrets]]
binding = "TOKEN"
store_id = "store-id"
secret_name = "api-token"
`,
  );
  expect(validateInfrastructureFiles(root, { ...plan, artifact: "worker.toml" }).ok).toBe(true);
  const source = readFileSync(join(root, "worker.toml"), "utf8");
  writeFileSync(
    join(root, "worker.toml"),
    `${source}\n[env.production]\nname = "production-api"\n`,
  );
  expect(validateInfrastructureFiles(root, { ...plan, artifact: "worker.toml" }).ok).toBe(false);
});
it("rejects missing files, traversal and symlinks outside the project with a stable diagnostic", () => {
  const { root, plan } = setup("aws-lambda");
  const outside = mkdtempSync(join(tmpdir(), "croco-outside-"));
  roots.push(outside);
  writeFileSync(join(outside, "secret.json"), "sensitive-content");
  symlinkSync(join(outside, "secret.json"), join(root, "link.json"));
  for (const artifact of [
    "missing.json",
    "../secret.json",
    join(outside, "secret.json"),
    "link.json",
  ]) {
    const result = validateInfrastructureFiles(root, { ...plan, artifact });
    expect(result.diagnostics).toEqual([{ code: "CROCO_INFRA_SCHEMA" }]);
    expect(JSON.stringify(result)).not.toContain("sensitive-content");
  }
});
