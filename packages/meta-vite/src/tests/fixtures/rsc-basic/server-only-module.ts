import { readFileSync } from "node:fs";

export const serverOnlyModuleReference = "node:fs";

export function readPackageMarker() {
  return readFileSync(new URL("../../../../package.json", import.meta.url), "utf8").includes(
    "@croco/meta-vite",
  );
}
