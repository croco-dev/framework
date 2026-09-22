import { defineCommand } from "citty";
import type { CrocoCommandRuntime } from "../libs/cliRuntime.js";
import { getCrocoCommandRuntime } from "../libs/cliRuntime.js";

export const DESKTOP_REMOVED_DIAGNOSTIC = {
  code: "CROCO_DESKTOP_REMOVED",
  message:
    "Croco desktop contracts and code generation are no longer supported. " +
    "Pin the framework checkout to 7dc3a10fb4bea30b667275e316b6e79971dde6c8 while migrating; " +
    "Croco does not replace desktop commands with a web scaffold.",
} as const;

export const DESKTOP_REMOVED_MESSAGE = `${DESKTOP_REMOVED_DIAGNOSTIC.code}: ${DESKTOP_REMOVED_DIAGNOSTIC.message}`;

const removedDesktopLeaf = defineCommand({
  meta: {
    name: "removed",
    description: "Report that Croco desktop support was removed",
  },
  run() {
    runDesktopRemoved(getCrocoCommandRuntime());
  },
});

export const desktopRemoved = defineCommand({
  meta: {
    name: "desktop",
    description: "Removed: Croco desktop contracts and code generation",
  },
  subCommands: {
    generate: removedDesktopLeaf,
    check: removedDesktopLeaf,
    diff: removedDesktopLeaf,
  },
  run() {
    runDesktopRemoved(getCrocoCommandRuntime());
  },
});

export function runDesktopRemoved(runtime: CrocoCommandRuntime): { readonly exitCode: 1 } {
  runtime.stderr(DESKTOP_REMOVED_MESSAGE);
  runtime.setExitCode(1);
  return { exitCode: 1 };
}
