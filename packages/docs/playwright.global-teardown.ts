import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, resolve } from "node:path";

export function cleanupIsolatedBuildRoot(): void {
  const configuredRoot = process.env.CROCO_DOCS_PLAYWRIGHT_ROOT;
  if (!configuredRoot) return;

  const isolatedRoot = resolve(configuredRoot);
  if (
    dirname(isolatedRoot) !== resolve(tmpdir()) ||
    !basename(isolatedRoot).startsWith("croco-docs-playwright-")
  ) {
    return;
  }

  rmSync(isolatedRoot, { recursive: true, force: true });
}

export default cleanupIsolatedBuildRoot;
