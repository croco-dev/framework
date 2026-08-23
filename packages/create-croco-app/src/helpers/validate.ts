import { existsSync, readdirSync } from "node:fs";
import { isAbsolute, resolve, win32 } from "node:path";

const PORTABLE_WEB_APP_NAME = /^[a-z0-9_-]+$/;
const WINDOWS_RESERVED_PATH_SEGMENT = /^(?:con|prn|aux|nul|clock\$|com[1-9]|lpt[1-9])$/i;
const RESERVED_PACKAGE_PATH_SEGMENTS = new Set(["node_modules"]);

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

export function parseWebAppNames(value: string): string[] {
  return value.split(",").map((name) => name.trim());
}

export function validateWebAppNames(names: readonly string[]): string | null {
  const seen = new Set<string>();

  for (const name of names) {
    const quotedName = JSON.stringify(name);

    if (name.length === 0) return "Web app names cannot contain empty entries";
    if (isAbsolute(name) || win32.isAbsolute(name)) {
      return `Invalid web app name ${quotedName}: absolute paths are not allowed`;
    }
    if (name === "." || name === "..") {
      return `Invalid web app name ${quotedName}: dot segments are not allowed`;
    }
    if (containsControlCharacter(name)) {
      return `Invalid web app name ${quotedName}: control characters are not allowed`;
    }
    if (name.includes("/") || name.includes("\\")) {
      return `Invalid web app name ${quotedName}: path separators are not allowed`;
    }
    if (WINDOWS_RESERVED_PATH_SEGMENT.test(name) || RESERVED_PACKAGE_PATH_SEGMENTS.has(name)) {
      return `Invalid web app name ${quotedName}: the name is reserved`;
    }
    if (!PORTABLE_WEB_APP_NAME.test(name)) {
      return `Invalid web app name ${quotedName}: use lowercase letters, numbers, hyphens, or underscores`;
    }
    if (name.startsWith("-") || name.endsWith("-")) {
      return `Invalid web app name ${quotedName}: the name cannot start or end with a hyphen`;
    }
    if (seen.has(name)) return `Duplicate web app name ${quotedName}`;

    seen.add(name);
  }

  return null;
}

function containsControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit <= 0x1f || codeUnit === 0x7f) return true;
  }

  return false;
}

export function checkDirectory(targetDir: string): { exists: boolean; isEmpty: boolean } {
  const resolved = resolve(targetDir);
  if (!existsSync(resolved)) return { exists: false, isEmpty: true };
  const entries = readdirSync(resolved);
  return { exists: true, isEmpty: entries.length === 0 };
}
