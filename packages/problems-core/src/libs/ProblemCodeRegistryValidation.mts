export type ProblemCodeRegistryValidationLifecycle = {
  readonly status?: string;
  readonly deprecation?: unknown;
};

export type ProblemCodeRegistryValidationEntry = {
  readonly code: string;
  readonly lifecycle?: ProblemCodeRegistryValidationLifecycle;
};

export function getProblemCodeDeprecationValidationErrors(
  problem: ProblemCodeRegistryValidationEntry,
  registryByCode: ReadonlyMap<string, ProblemCodeRegistryValidationEntry>,
): readonly string[] {
  const metadata = problem.lifecycle?.deprecation;
  const diagnostics: string[] = [];

  if (!metadata) {
    return [`Deprecated Problem code '${problem.code}' is missing deprecation metadata.`];
  }

  const metadataRecord = metadata as {
    readonly reason?: unknown;
    readonly migrationNote?: unknown;
    readonly replacementCode?: unknown;
    readonly noReplacementReason?: unknown;
  };
  const reason = getTrimmedString(metadataRecord.reason);
  const migrationNote = getTrimmedString(metadataRecord.migrationNote);
  const replacementCode = getTrimmedString(metadataRecord.replacementCode);
  const noReplacementReason = getTrimmedString(metadataRecord.noReplacementReason);

  if (!reason) {
    diagnostics.push(`Deprecated Problem code '${problem.code}' is missing deprecation reason.`);
  }

  if (!migrationNote) {
    diagnostics.push(`Deprecated Problem code '${problem.code}' is missing migration guidance.`);
  }

  if (!replacementCode && !noReplacementReason) {
    diagnostics.push(
      `Deprecated Problem code '${problem.code}' must declare replacementCode or noReplacementReason.`,
    );
  }

  if (replacementCode && noReplacementReason) {
    diagnostics.push(
      `Deprecated Problem code '${problem.code}' must not declare both replacementCode and noReplacementReason.`,
    );
  }

  if (!replacementCode) {
    return diagnostics;
  }

  if (replacementCode === problem.code) {
    diagnostics.push(
      `Deprecated Problem code '${problem.code}' replacementCode must reference a different Problem code.`,
    );
    return diagnostics;
  }

  const replacement = registryByCode.get(replacementCode);

  if (!replacement) {
    diagnostics.push(
      `Deprecated Problem code '${problem.code}' replacementCode '${replacementCode}' is not registered.`,
    );
    return diagnostics;
  }

  if ((replacement.lifecycle?.status ?? "active") === "deprecated") {
    diagnostics.push(
      `Deprecated Problem code '${problem.code}' replacementCode '${replacementCode}' points to a deprecated Problem code.`,
    );
  }

  return diagnostics;
}

function getTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
