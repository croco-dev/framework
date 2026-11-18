import type { ArgsDef } from "citty";

export const GLOBAL_OPTIONS = {
  cwd: {
    type: "string",
    description: "Working directory",
  },
  dryRun: {
    type: "boolean",
    description: "Preview changes without writing files",
  },
  overwrite: {
    type: "boolean",
    description: "Overwrite existing files",
  },
} satisfies ArgsDef;

export const DI_CHECK_FILE_OPTIONS: ReadonlySet<string> = new Set(["--manifest", "--out"]);

export function isDiCheckOptionValue(value: string | undefined): value is string {
  return Boolean(value && !value.startsWith("--") && value !== "-h");
}
