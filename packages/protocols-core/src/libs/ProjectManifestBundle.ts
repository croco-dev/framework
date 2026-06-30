export const PROJECT_MANIFEST_BUNDLE_ARTIFACT_ENTRIES = [
  ["contractGraph", "contract-graph.json"],
  ["problems", "problems.json"],
  ["diGraph", "di-graph.json"],
  ["runtime", "runtime.json"],
  ["policies", "policies.json"],
  ["providers", "providers.json"],
] as const;

export type ProjectManifestBundleArtifactKey =
  (typeof PROJECT_MANIFEST_BUNDLE_ARTIFACT_ENTRIES)[number][0];
export type ProjectManifestBundleArtifactFileName =
  (typeof PROJECT_MANIFEST_BUNDLE_ARTIFACT_ENTRIES)[number][1];

export const PROJECT_MANIFEST_BUNDLE_ARTIFACTS = Object.fromEntries(
  PROJECT_MANIFEST_BUNDLE_ARTIFACT_ENTRIES,
) as Record<ProjectManifestBundleArtifactKey, ProjectManifestBundleArtifactFileName>;

export function normalizeProjectManifestBundlePath(bundlePath: string): string {
  const normalized = bundlePath.split("\\").join("/").replace(/\/+$/, "");
  return normalized.length > 0 ? normalized : ".";
}

export function joinProjectManifestBundlePath(
  directory: string,
  fileName: ProjectManifestBundleArtifactFileName,
): string {
  return directory === "." ? fileName : `${directory}/${fileName}`;
}

export function createProjectManifestBundleArtifactPaths(
  directory: string,
): Record<ProjectManifestBundleArtifactKey, string> {
  return Object.fromEntries(
    PROJECT_MANIFEST_BUNDLE_ARTIFACT_ENTRIES.map(([key, fileName]) => [
      key,
      joinProjectManifestBundlePath(directory, fileName),
    ]),
  ) as Record<ProjectManifestBundleArtifactKey, string>;
}
