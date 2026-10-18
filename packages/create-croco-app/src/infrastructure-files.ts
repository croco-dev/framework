import { ProblemFactory } from "@croco/problems-core";
import { readFileSync, realpathSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { parseAllDocuments } from "yaml";
import { parse as parseToml } from "smol-toml";
import { RUNTIME_CAPABILITY_MANIFEST_VERSION } from "@croco/framework-context";
import { validateInfrastructure } from "./infrastructure.js";
import type {
  InfrastructureValidationInput,
  InfrastructureValidationReport,
} from "./infrastructure.js";

export type InfrastructureFilePlan = Omit<
  InfrastructureValidationInput,
  "requirements" | "artifact"
> & {
  readonly requirements: string;
  readonly artifact: string;
  readonly runtimeManifest: string;
};

/** Read-only CI adapter. Paths must remain inside root, including after resolving symlinks. */
export function validateInfrastructureFiles(
  root: string,
  plan: InfrastructureFilePlan,
): InfrastructureValidationReport {
  const failed: InfrastructureValidationReport = {
    schemaVersion: "croco.infrastructure-validation/v1",
    ok: false,
    diagnostics: [{ code: "CROCO_INFRA_SCHEMA" }],
    verification: "static-artifact-only",
    certification: "not-certified",
  };
  try {
    const base = realpathSync(root);
    const read = (file: string): string => {
      if (typeof file !== "string" || isAbsolute(file)) throw invalidArtifact();
      const path = realpathSync(resolve(base, file));
      const local = relative(base, path);
      if (local === ".." || local.startsWith("../") || isAbsolute(local)) throw invalidArtifact();
      return readFileSync(path, "utf8");
    };
    const requirements = JSON.parse(read(plan.requirements));
    const runtime = JSON.parse(read(plan.runtimeManifest));
    const source = read(plan.artifact);
    const artifact: unknown = /\.ya?ml$/.test(plan.artifact)
      ? (() => {
          const documents = parseAllDocuments(source);
          if (
            documents.some((document) => document.errors.length > 0 || document.warnings.length > 0)
          )
            throw invalidArtifact();
          const values = documents.map((document) => document.toJSON());
          if (plan.profile !== "kubernetes" && values.length !== 1) {
            throw invalidArtifact();
          }
          return plan.profile === "kubernetes" && values.length > 1 ? values : values[0];
        })()
      : plan.artifact.endsWith(".toml")
        ? parseToml(source)
        : JSON.parse(source);
    const result = validateInfrastructure({ ...plan, requirements, artifact });
    if (
      runtime.version !== RUNTIME_CAPABILITY_MANIFEST_VERSION ||
      runtime.platform !== requirements.runtime ||
      !Array.isArray(runtime.diagnostics) ||
      runtime.diagnostics.length > 0 ||
      !Array.isArray(requirements.runtimeCapabilities) ||
      requirements.runtimeCapabilities.some(
        (capability: string) => runtime.capabilities?.[capability] !== true,
      )
    ) {
      return {
        ...result,
        ok: false,
        diagnostics: [...result.diagnostics, { code: "CROCO_INFRA_RUNTIME" }],
      };
    }
    return result;
  } catch {
    // Parser and filesystem errors can contain entire secret documents. Return only a stable code.
    return failed;
  }
}

function invalidArtifact() {
  return ProblemFactory.badRequest(
    "infrastructure/invalid-artifact",
    "Unsupported infrastructure input",
  );
}
