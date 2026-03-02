import { join } from 'node:path';
import fsExtra from 'fs-extra';

const { pathExistsSync, readJsonSync, writeJsonSync } = fsExtra;

export function mergePackageJson(targetDir: string, additions: Record<string, unknown>): void {
  const pkgPath = join(targetDir, 'package.json');
  const existing = pathExistsSync(pkgPath) ? readJsonSync(pkgPath) : {};
  const merged = deepMerge(existing, additions);
  writeJsonSync(pkgPath, merged, { spaces: 2 });
}

function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const result = { ...target };
  for (const [key, value] of Object.entries(source)) {
    if (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      typeof result[key] === 'object' &&
      result[key] !== null &&
      !Array.isArray(result[key])
    ) {
      result[key] = deepMerge(result[key] as Record<string, unknown>, value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}
