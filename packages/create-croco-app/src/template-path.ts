import { fileURLToPath } from "node:url";

export function resolveTemplatesDir(
  moduleUrl: string | URL,
  platform: NodeJS.Platform = process.platform,
): string {
  return fileURLToPath(new URL("../templates", moduleUrl), { windows: platform === "win32" });
}

export const TEMPLATES_DIR = resolveTemplatesDir(import.meta.url);
