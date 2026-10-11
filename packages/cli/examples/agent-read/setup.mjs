import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createFrontendActionManifestFromRoutes } from "@croco/rpc-codegen";
import { definition, digest, grant, resultFor } from "./application.mjs";

export async function createExampleFiles(root) {
  await mkdir(root, { recursive: true });
  const manifest = createFrontendActionManifestFromRoutes([
    {
      controllerName: "UsersController",
      methodName: "list",
      httpMethod: "GET",
      path: "/users",
      routeContract: null,
      params: [],
      inputSchema: null,
      inputSchemas: { body: null, query: null, params: null, headers: null },
      outputSchema: null,
      domain: null,
    },
  ]);
  const result = resultFor({ actionCount: manifest.actions.length });
  const resultHash = digest(result);
  const reviewed = {
    reviewerId: "local-fixture-reviewer",
    reviewedAt: "2026-09-02T00:00:00.000Z",
    definitionHash: definition.hash,
    resultHash,
  };
  const report = {
    id: "frontend-reviewed-1",
    queryId: "frontend.actions",
    queryVersion: 1,
    inputKey: "{}",
    resultHash,
    result,
    reviewed,
    ...grant,
    expiresAt: "2099-01-01T00:00:00.000Z",
  };
  for (const [name, value] of Object.entries({
    "frontend-actions.json": manifest,
    "reviewed-reports.json": [report],
    "review-provenance.json": { reportId: report.id, ...reviewed },
  })) {
    await writeFile(resolve(root, name), `${JSON.stringify(value, null, 2)}\n`);
  }
  execFileSync("git", ["init", "--quiet", root]);
  execFileSync("git", ["-C", root, "add", "frontend-actions.json"]);
  execFileSync("git", [
    "-C",
    root,
    "-c",
    "user.name=Croco local fixture",
    "-c",
    "user.email=fixture@example.invalid",
    "-c",
    "commit.gpgsign=false",
    "-c",
    "core.hooksPath=/dev/null",
    "commit",
    "--quiet",
    "--allow-empty",
    "-m",
    "Generate frontend action fixture",
  ]);
  const commit = execFileSync("git", ["-C", root, "rev-parse", "HEAD"], { encoding: "utf8" });
  await writeFile(resolve(root, "source-commit.txt"), commit);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = process.argv[2];
  if (!root) throw new TypeError("Pass an output directory");
  await createExampleFiles(resolve(root));
}
