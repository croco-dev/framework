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
