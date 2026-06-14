import packageJson from "../package.json";

type PackageManifest = {
  version?: unknown;
};

export function getPackageVersion(): string {
  const manifest = packageJson as PackageManifest;

  if (typeof manifest.version !== "string" || manifest.version.length === 0) {
    throw new Error("Missing package version in package.json");
  }

  return manifest.version;
}
