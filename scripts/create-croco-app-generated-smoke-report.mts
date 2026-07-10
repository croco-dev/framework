import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";

export type GeneratedSmokeArtifact = {
  readonly sourcePath: string;
  readonly reportPath: string;
  readonly reportRelativePath: string;
};

export function copyGeneratedSmokeArtifacts(options: {
  readonly generatedSmokeReportDir: string;
  readonly smokeCaseName: string;
  readonly validationDir: string;
  readonly artifactPaths: readonly string[];
}): readonly GeneratedSmokeArtifact[] {
  const artifactRoot = join(options.generatedSmokeReportDir, "artifacts", options.smokeCaseName);

  return options.artifactPaths.map((artifactPath) => {
    const sourcePath = join(options.validationDir, artifactPath);
    if (!existsSync(sourcePath)) {
      throw new Error(`Generated smoke artifact path does not exist: ${sourcePath}`);
    }

    const reportPath = join(artifactRoot, artifactPath);
    mkdirSync(dirname(reportPath), { recursive: true });
    copyFileSync(sourcePath, reportPath);

    return {
      sourcePath,
      reportPath,
      reportRelativePath: normalizePath(relative(options.generatedSmokeReportDir, reportPath)),
    };
  });
}

export function renderGeneratedSmokeArtifacts(
  artifacts: readonly GeneratedSmokeArtifact[],
): string {
  if (artifacts.length === 0) {
    return "_none_";
  }

  return artifacts
    .map((artifact) => `\`${escapeBackticks(artifact.reportRelativePath)}\``)
    .join(", ");
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/");
}

function escapeBackticks(value: string): string {
  return value.replace(/`/g, "\\`");
}
