import type { BuildArtifact, EntryDescriptor, OutputContract } from "./output-contract";

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

export class OutputContractValidator {
  validate(contract: OutputContract): ValidationReport {
    const results: ValidationResult[] = [];
    const path = `contract:${contract.presetName}`;

    if (!contract.presetName) {
      results.push({ path, severity: "error", message: "presetName is required" });
    }
    if (!contract.buildTime) {
      results.push({ path, severity: "error", message: "buildTime is required" });
    }
    if (!contract.format) {
      results.push({ path, severity: "error", message: "format is required" });
    }
    if (!contract.artifacts || contract.artifacts.length === 0) {
      results.push({
        path,
        severity: "warning",
        message: "No artifacts defined — contract is empty",
      });
    }
    if (!contract.entries || contract.entries.length === 0) {
      results.push({ path, severity: "error", message: "At least one entry point is required" });
    }

    if (contract.artifacts) {
      for (const artifact of contract.artifacts) {
        this.validateArtifact(artifact, results);
      }
    }

    if (contract.entries) {
      for (const entry of contract.entries) {
        this.validateEntry(entry, results);
      }
    }

    this.crossCheckEntriesVsArtifacts(contract, results);

    return {
      contractName: contract.presetName,
      passed: results.filter((result) => result.severity === "error").length === 0,
      results,
    };
  }

  private validateArtifact(artifact: BuildArtifact, results: ValidationResult[]): void {
    const path = `artifact:${artifact.path}`;
    if (!artifact.path) {
      results.push({ path, severity: "error", message: "Artifact path is required" });
    }
    if (!artifact.format) {
      results.push({
        path,
        severity: "error",
        message: `Artifact '${artifact.path}' missing format`,
      });
    }
    if (!artifact.type) {
      results.push({
        path,
        severity: "error",
        message: `Artifact '${artifact.path}' missing type`,
      });
    }
  }

  private validateEntry(entry: EntryDescriptor, results: ValidationResult[]): void {
    const path = `entry:${entry.exportName}`;
    if (!entry.exportName) {
      results.push({ path, severity: "error", message: "Entry export name is required" });
    }
    if (!entry.main) {
      results.push({
        path,
        severity: "error",
        message: `Entry '${entry.exportName}' missing main file`,
      });
    }
    if (!entry.types) {
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
    const artifactPaths = new Set(contract.artifacts.map((artifact) => artifact.path));
    const referencedPaths = new Set<string>();

    for (const entry of contract.entries) {
      if (entry.main) {
        referencedPaths.add(entry.main);
      }
      if (entry.cjs) {
        referencedPaths.add(entry.cjs);
      }
      if (entry.types) {
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
}
