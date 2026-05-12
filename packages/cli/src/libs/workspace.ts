import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { WORKSPACE_MAX_DEPTH } from "./constants.js";

export interface WorkspaceContext {
  root: string | null;
  hasApiServer: boolean;
  hasConsoleWeb: boolean;
}

export async function detect(cwd: string): Promise<WorkspaceContext> {
  let current = cwd;
  for (let i = 0; i < WORKSPACE_MAX_DEPTH; i++) {
    if (existsSync(join(current, "pnpm-workspace.yaml"))) {
      return {
        root: current,
        hasApiServer: existsSync(join(current, "apps", "api-server", "package.json")),
        hasConsoleWeb: existsSync(join(current, "apps", "console-web", "package.json")),
      };
    }
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return { root: null, hasApiServer: false, hasConsoleWeb: false };
}
