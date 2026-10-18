import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { validateInfrastructureFiles } from "create-croco-app/dist/verification.js";

const root = new URL("../", import.meta.url);
try {
  const plan = JSON.parse(
    readFileSync(new URL("croco-infrastructure-bindings.json", root), "utf8"),
  );
  const result = validateInfrastructureFiles(fileURLToPath(root), plan);
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
} catch {
  console.error("CROCO_INFRA_SCHEMA");
  process.exitCode = 1;
}
