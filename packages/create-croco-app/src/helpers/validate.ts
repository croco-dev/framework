import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

export function validateProjectName(name: string): string | null {
  if (!name) return "Project name is required";
  if (!/^[a-z0-9-_]+$/.test(name)) {
    return "Project name must contain only lowercase letters, numbers, hyphens, and underscores";
  }
  if (name.startsWith("-") || name.endsWith("-")) {
    return "Project name cannot start or end with a hyphen";
  }
  return null;
}

export function checkDirectory(targetDir: string): { exists: boolean; isEmpty: boolean } {
  const resolved = resolve(targetDir);
  if (!existsSync(resolved)) return { exists: false, isEmpty: true };
  const entries = readdirSync(resolved);
  return { exists: true, isEmpty: entries.length === 0 };
}
