import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { REST_SPA_CONTRACT_SMOKE_CASE_NAME } from "./create-croco-app-generated-smoke-matrix.mts";

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
      reportRelativePath: toPosixPath(relative(options.generatedSmokeReportDir, reportPath)),
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

export type SmokeCaseRecoverySummary = {
  readonly localRerunCommand: string;
};

export type SmokeCaseArtifactBundle = {
  readonly path: string;
  readonly stdoutPath: string;
  readonly stderrPath: string;
  readonly files: readonly string[];
  readonly outputTruncated: boolean;
};

export type SmokeFailureClassification = {
  readonly kind: "deterministic" | "suspectedFlaky";
  readonly reason: string;
};

export type SmokeCommandFailureEvidence = {
  readonly message: string;
  readonly stdout: string;
  readonly stderr: string;
  readonly signal: string | null;
};

export function createSmokeRecoverySummary(caseName: string): SmokeCaseRecoverySummary {
  return {
    localRerunCommand: `pnpm create-croco-app:smoke ${caseName}`,
  };
}

export function classifySmokeFailure(input: {
  readonly message: string;
  readonly stdout?: string;
  readonly stderr?: string;
  readonly signal?: string | null;
}): SmokeFailureClassification {
  const output = [input.message, input.stdout, input.stderr, input.signal]
    .filter(Boolean)
    .join("\n");
  const matchedIndicator = [
    /\bETIMEDOUT\b/i,
    /\bEAI_AGAIN\b/i,
    /\bECONNRESET\b/i,
    /\bsocket hang up\b/i,
    /\bnetwork timeout\b/i,
    /\bfetch failed\b/i,
    /\bERR_SOCKET_CONNECTION_TIMEOUT\b/i,
    /\bERR_NETWORK\b/i,
    /\bSIG(?:TERM|KILL)\b/i,
  ].find((pattern) => pattern.test(output));

  if (matchedIndicator) {
    return {
      kind: "suspectedFlaky",
      reason: `transient failure indicator matched ${matchedIndicator.source}`,
    };
  }

  return {
    kind: "deterministic",
    reason: "no transient timeout, network, DNS, socket, fetch, or termination indicator detected",
  };
}

export function classifySmokeCommandFailure(
  input: SmokeCommandFailureEvidence,
): SmokeFailureClassification {
  return classifySmokeFailure({
    message: "",
    stdout: input.stdout,
    stderr: input.stderr,
    signal: input.signal,
  });
}

export function extractSmokeCommandDiagnosticCodes(
  input: SmokeCommandFailureEvidence,
): readonly string[] {
  return extractSmokeDiagnosticCodes([input.stdout, input.stderr].join("\n"));
}

export function extractSmokeDiagnosticCodes(output: string): readonly string[] {
  return [
    ...new Set(output.match(/\b(?:CROCO_[A-Z0-9_]+|[a-z0-9-]+\/[a-z0-9-]+)\b/g) ?? []),
  ].sort();
}

const ignoredArtifactDirectories = new Set([
  ".git",
  ".next",
  ".output",
  ".turbo",
  ".wrangler",
  "coverage",
  "dist",
  "node_modules",
]);

const caseSpecificSmokeFailureArtifactPaths: Readonly<Record<string, readonly string[]>> = {
  [REST_SPA_CONTRACT_SMOKE_CASE_NAME]: ["apps/api-server/src/controllers/userSchemas.ts"],
};

export function shouldSkipSmokeArtifactDirectory(name: string): boolean {
  return ignoredArtifactDirectories.has(name);
}

export function shouldIncludeSmokeFailureArtifact(
  relativePath: string,
  caseName?: string,
): boolean {
  const normalizedPath = toPosixPath(relativePath);
  const segments = normalizedPath.split("/");
  const fileName = segments.at(-1) ?? "";

  if (segments.some((segment) => shouldSkipSmokeArtifactDirectory(segment))) {
    return false;
  }

  if (
    fileName === "package.json" ||
    fileName === "pnpm-workspace.yaml" ||
    fileName === "pnpm-lock.yaml" ||
    fileName === "turbo.json" ||
    /^croco(?:[.-].*)?\.json$/.test(fileName) ||
    fileName === "openapi.json" ||
    fileName === "strict-openapi-canary.json" ||
    fileName === "contract-graph.snapshot.json" ||
    fileName === "contract-graph.coverage.json" ||
    /^tsconfig(?:\..+)?\.json$/.test(fileName) ||
    /^(?:babel|next|open-next|postcss|sst|tailwind|vite)\.config\.[cm]?[jt]s$/.test(fileName) ||
    fileName === "wrangler.toml" ||
    /^Dockerfile(?:\..+)?$/.test(fileName)
  ) {
    return true;
  }

  return (
    segments[0] === ".croco" ||
    (caseName !== undefined &&
      (caseSpecificSmokeFailureArtifactPaths[caseName] ?? []).includes(normalizedPath))
  );
}

export function collectSmokeFailureArtifactFiles(projectDir: string, caseName: string): string[] {
  return collectSmokeFailureArtifactFilesInDirectory(projectDir, projectDir, caseName);
}

function collectSmokeFailureArtifactFilesInDirectory(
  projectDir: string,
  directory: string,
  caseName: string,
): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);
    const relativePath = relative(projectDir, entryPath);
    if (entry.isDirectory()) {
      return shouldSkipSmokeArtifactDirectory(entry.name)
        ? []
        : collectSmokeFailureArtifactFilesInDirectory(projectDir, entryPath, caseName);
    }

    return entry.isFile() && shouldIncludeSmokeFailureArtifact(relativePath, caseName)
      ? [entryPath]
      : [];
  });
}

export function toPosixPath(value: string): string {
  return value.replace(/\\/g, "/");
}

function escapeBackticks(value: string): string {
  return value.replace(/`/g, "\\`");
}
