import type {
  BuildArtifact,
  DeployTarget,
  EntryDescriptor,
  GeneratedRuntimeProfile,
  GeneratedRuntimeProfileCatalog,
  OutputContract,
  PresentationRuntime,
} from "./output-contract";

export type ValidationSeverity = "error" | "warning";

export type ValidationResult = {
  readonly path: string;
  readonly severity: ValidationSeverity;
  readonly message: string;
};

export type ValidationReport = {
  readonly contractName: string;
  readonly passed: boolean;
  readonly results: readonly ValidationResult[];
};

export type RuntimeClaimValidationOptions = {
  readonly claimedRuntimes?: readonly string[];
};

const ARTIFACT_FORMATS = new Set(["esm", "cjs", "dual", "neutral"]);
const ARTIFACT_TYPES = new Set(["code", "types", "config", "asset"]);
const PRESENTATION_RUNTIMES = new Set(["node", "lambda", "cloudflare-workers", "browser"]);

export class OutputContractValidator {
  validate(contract: OutputContract): ValidationReport {
    const results: ValidationResult[] = [];
    this.validateOutputContract(contract, results);

    return {
      contractName: contract.presetName,
      passed: hasNoErrors(results),
      results,
    };
  }

  validateDeployTarget(target: DeployTarget): ValidationReport {
    const results: ValidationResult[] = [];
    this.validateDeployTargetShape(target, results);

    return {
      contractName: target.target,
      passed: hasNoErrors(results),
      results,
    };
  }

  validateGeneratedRuntimeProfile(profile: GeneratedRuntimeProfile): ValidationReport {
    const results: ValidationResult[] = [];
    this.validateGeneratedRuntimeProfileShape(profile, results);

    return {
      contractName:
        isRecord(profile) && isNonEmptyString(profile.name) ? profile.name : "profile:<invalid>",
      passed: hasNoErrors(results),
      results,
    };
  }

  validateGeneratedRuntimeProfileCatalog(
    catalog: GeneratedRuntimeProfileCatalog,
    options: RuntimeClaimValidationOptions = {},
  ): ValidationReport {
    const results: ValidationResult[] = [];
    const profileNames = new Set<string>();
    const profileRuntimes = new Set<PresentationRuntime>();

    if (catalog.schemaVersion !== 1) {
      results.push({
        path: "profile-catalog:schemaVersion",
        severity: "error",
        message: "Generated runtime profile catalog schemaVersion must be 1",
      });
    }
    if (typeof catalog.validationCommand !== "string" || catalog.validationCommand.length === 0) {
      results.push({
        path: "profile-catalog:validationCommand",
        severity: "error",
        message: "Generated runtime profile catalog validationCommand is required",
      });
    }
    const profiles = Array.isArray(catalog.profiles) ? catalog.profiles : [];
    if (profiles.length === 0) {
      results.push({
        path: "profile-catalog:profiles",
        severity: "error",
        message: "Generated runtime profile catalog must define at least one profile",
      });
    }

    for (const profile of profiles) {
      this.validateGeneratedRuntimeProfileShape(profile, results);

      if (!isRecord(profile)) {
        continue;
      }

      if (isNonEmptyString(profile.name)) {
        if (profileNames.has(profile.name)) {
          results.push({
            path: `profile:${profile.name}`,
            severity: "error",
            message: `Generated runtime profile '${profile.name}' is duplicated`,
          });
        }
        profileNames.add(profile.name);
      }

      if (isPresentationRuntime(profile.runtime)) {
        profileRuntimes.add(profile.runtime);
      }
    }

    for (const runtime of options.claimedRuntimes ?? []) {
      if (!isPresentationRuntime(runtime)) {
        results.push({
          path: `profile-catalog:claimed-runtime:${runtime}`,
          severity: "error",
          message: `Catalog runtime claim '${runtime}' is not a supported presentation runtime`,
        });
        continue;
      }

      if (!profileRuntimes.has(runtime)) {
        results.push({
          path: `profile-catalog:claimed-runtime:${runtime}`,
          severity: "error",
          message: `Catalog runtime claim '${runtime}' has no generated runtime profile evidence`,
        });
      }
    }

    return {
      contractName: "presentation-runtime-profiles",
      passed: hasNoErrors(results),
      results,
    };
  }

  private validateOutputContract(contract: OutputContract, results: ValidationResult[]): void {
    if (!isRecord(contract)) {
      results.push({
        path: "contract:<invalid>",
        severity: "error",
        message: "Output contract must be an object",
      });
      return;
    }

    const path = isNonEmptyString(contract.presetName)
      ? `contract:${contract.presetName}`
      : "contract:<unknown>";

    if (!isNonEmptyString(contract.presetName)) {
      results.push({ path, severity: "error", message: "presetName is required" });
    }
    if (!isNonEmptyString(contract.buildTime)) {
      results.push({ path, severity: "error", message: "buildTime is required" });
    }
    if (!isNonEmptyString(contract.format)) {
      results.push({ path, severity: "error", message: "format is required" });
    } else if (!isArtifactFormat(contract.format)) {
      results.push({
        path,
        severity: "error",
        message: `format '${contract.format}' is not supported`,
      });
    }

    const artifacts = Array.isArray(contract.artifacts) ? contract.artifacts : [];
    if (!Array.isArray(contract.artifacts)) {
      results.push({ path, severity: "error", message: "artifacts must be an array" });
    } else if (artifacts.length === 0) {
      results.push({
        path,
        severity: "warning",
        message: "No artifacts defined - contract is empty",
      });
    }
    const entries = Array.isArray(contract.entries) ? contract.entries : [];
    if (!Array.isArray(contract.entries)) {
      results.push({ path, severity: "error", message: "entries must be an array" });
    } else if (entries.length === 0) {
      results.push({ path, severity: "error", message: "At least one entry point is required" });
    }

    if (Array.isArray(contract.artifacts)) {
      for (const artifact of artifacts) {
        this.validateArtifact(artifact, results);
      }
    }

    if (Array.isArray(contract.entries)) {
      for (const entry of entries) {
        this.validateEntry(entry, results);
      }
    }

    if (Array.isArray(contract.artifacts) && Array.isArray(contract.entries)) {
      this.crossCheckEntriesVsArtifacts(contract, results);
    }
  }

  private validateArtifact(artifact: BuildArtifact, results: ValidationResult[]): void {
    if (!isRecord(artifact)) {
      results.push({
        path: "artifact:<invalid>",
        severity: "error",
        message: "Artifact must be an object",
      });
      return;
    }

    const path = isNonEmptyString(artifact.path)
      ? `artifact:${artifact.path}`
      : "artifact:<unknown>";
    if (!isNonEmptyString(artifact.path)) {
      results.push({ path, severity: "error", message: "Artifact path is required" });
    }
    if (!isNonEmptyString(artifact.format)) {
      results.push({
        path,
        severity: "error",
        message: `Artifact '${artifact.path}' missing format`,
      });
    } else if (!isArtifactFormat(artifact.format)) {
      results.push({
        path,
        severity: "error",
        message: `Artifact '${artifact.path}' has unsupported format '${artifact.format}'`,
      });
    }
    if (!isNonEmptyString(artifact.type)) {
      results.push({
        path,
        severity: "error",
        message: `Artifact '${artifact.path}' missing type`,
      });
    } else if (!isArtifactType(artifact.type)) {
      results.push({
        path,
        severity: "error",
        message: `Artifact '${artifact.path}' has unsupported type '${artifact.type}'`,
      });
    }
  }

  private validateEntry(entry: EntryDescriptor, results: ValidationResult[]): void {
    if (!isRecord(entry)) {
      results.push({
        path: "entry:<invalid>",
        severity: "error",
        message: "Entry must be an object",
      });
      return;
    }

    const path = isNonEmptyString(entry.exportName)
      ? `entry:${entry.exportName}`
      : "entry:<unknown>";
    if (!isNonEmptyString(entry.exportName)) {
      results.push({ path, severity: "error", message: "Entry export name is required" });
    }
    if (!isNonEmptyString(entry.main)) {
      results.push({
        path,
        severity: "error",
        message: `Entry '${entry.exportName}' missing main file`,
      });
    }
    if (!isNonEmptyString(entry.types)) {
      results.push({
        path,
        severity: "error",
        message: `Entry '${entry.exportName}' missing types file`,
      });
    }
  }

  private crossCheckEntriesVsArtifacts(
    contract: OutputContract,
    results: ValidationResult[],
  ): void {
    const artifactPaths = new Set<string>();
    for (const artifact of contract.artifacts) {
      if (isRecord(artifact) && isNonEmptyString(artifact.path)) {
        artifactPaths.add(artifact.path);
      }
    }
    const referencedPaths = new Set<string>();

    for (const entry of contract.entries) {
      if (!isRecord(entry)) {
        continue;
      }

      if (isNonEmptyString(entry.main)) {
        referencedPaths.add(entry.main);
      }
      if (isNonEmptyString(entry.cjs)) {
        referencedPaths.add(entry.cjs);
      }
      if (isNonEmptyString(entry.types)) {
        referencedPaths.add(entry.types);
      }
    }

    for (const refPath of referencedPaths) {
      if (!artifactPaths.has(refPath)) {
        results.push({
          path: `cross-check:${refPath}`,
          severity: "error",
          message: `Entry references '${refPath}' but no matching artifact exists`,
        });
      }
    }
  }

  private validateDeployTargetShape(target: DeployTarget, results: ValidationResult[]): void {
    if (!isRecord(target)) {
      results.push({
        path: "target:<invalid>",
        severity: "error",
        message: "Deploy target must be an object",
      });
      return;
    }

    const path = isNonEmptyString(target.target) ? `target:${target.target}` : "target:<unknown>";
    if (!isNonEmptyString(target.target)) {
      results.push({ path, severity: "error", message: "Deploy target is required" });
    }

    if (
      target.requiredEnvVars !== undefined &&
      (!Array.isArray(target.requiredEnvVars) ||
        !target.requiredEnvVars.every((envVar) => isNonEmptyString(envVar)))
    ) {
      results.push({
        path,
        severity: "error",
        message: "Deploy target requiredEnvVars must contain non-empty strings",
      });
    }

    if (target.runtime !== undefined) {
      if (!isRecord(target.runtime)) {
        results.push({
          path,
          severity: "error",
          message: "Deploy target runtime metadata must be an object when provided",
        });
      } else {
        if (
          target.runtime.nodeVersion !== undefined &&
          !isNonEmptyString(target.runtime.nodeVersion)
        ) {
          results.push({
            path,
            severity: "error",
            message: "Deploy target runtime.nodeVersion must be non-empty when provided",
          });
        }
        if (target.runtime.memory !== undefined && !isPositiveNumber(target.runtime.memory)) {
          results.push({
            path,
            severity: "error",
            message: "Deploy target runtime.memory must be greater than 0 when provided",
          });
        }
        if (target.runtime.timeout !== undefined && !isPositiveNumber(target.runtime.timeout)) {
          results.push({
            path,
            severity: "error",
            message: "Deploy target runtime.timeout must be greater than 0 when provided",
          });
        }
      }
    }

    if (!isRecord(target.output)) {
      results.push({ path, severity: "error", message: "Deploy target output is required" });
      return;
    }

    this.validateOutputContract(target.output, results);
  }

  private validateGeneratedRuntimeProfileShape(
    profile: GeneratedRuntimeProfile,
    results: ValidationResult[],
  ): void {
    if (!isRecord(profile)) {
      results.push({
        path: "profile:<invalid>",
        severity: "error",
        message: "Generated runtime profile must be an object",
      });
      return;
    }

    const path = isNonEmptyString(profile.name) ? `profile:${profile.name}` : "profile:<unknown>";

    if (!isNonEmptyString(profile.name)) {
      results.push({
        path,
        severity: "error",
        message: "Generated runtime profile name is required",
      });
    }
    if (!isNonEmptyString(profile.runtime)) {
      results.push({
        path,
        severity: "error",
        message: "Generated runtime profile runtime is required",
      });
    } else if (!isPresentationRuntime(profile.runtime)) {
      results.push({
        path,
        severity: "error",
        message: `Generated runtime profile '${profile.name}' has unsupported runtime '${profile.runtime}'`,
      });
    }
    if (!isNonEmptyString(profile.packageTestName)) {
      results.push({
        path,
        severity: "error",
        message: `Generated runtime profile '${profile.name}' must name its package test evidence`,
      });
    }
    if (!isNonEmptyString(profile.generatedAppSmokeCase)) {
      results.push({
        path,
        severity: "error",
        message: `Generated runtime profile '${profile.name}' must name its generated app smoke case`,
      });
    }
    if (!isNonEmptyString(profile.generatedAppSmokeCommand)) {
      results.push({
        path,
        severity: "error",
        message: `Generated runtime profile '${profile.name}' must name its generated app smoke command`,
      });
    } else if (
      profile.generatedAppSmokeCase &&
      !profile.generatedAppSmokeCommand.includes(profile.generatedAppSmokeCase)
    ) {
      results.push({
        path,
        severity: "error",
        message: `Generated runtime profile '${profile.name}' smoke command must include case '${profile.generatedAppSmokeCase}'`,
      });
    }

    if (!isRecord(profile.target)) {
      results.push({
        path,
        severity: "error",
        message: `Generated runtime profile '${profile.name}' must include deploy target metadata`,
      });
      return;
    }

    if (profile.runtime && profile.target.target && profile.target.target !== profile.runtime) {
      results.push({
        path: `target:${profile.target.target}`,
        severity: "error",
        message: `Generated runtime profile '${profile.name}' target '${profile.target.target}' does not match runtime '${profile.runtime}'`,
      });
    }
    this.validateDeployTargetShape(profile.target, results);
  }
}

function isArtifactFormat(value: string): boolean {
  return ARTIFACT_FORMATS.has(value);
}

function isArtifactType(value: string): boolean {
  return ARTIFACT_TYPES.has(value);
}

function isPresentationRuntime(value: unknown): value is PresentationRuntime {
  return typeof value === "string" && PRESENTATION_RUNTIMES.has(value);
}

function hasNoErrors(results: readonly ValidationResult[]): boolean {
  return results.filter((result) => result.severity === "error").length === 0;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && value > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
