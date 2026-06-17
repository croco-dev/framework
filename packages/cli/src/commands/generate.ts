import { defineCommand } from "citty";
import { generateScaffold } from "./generateScaffold.js";
import { generateUsageDashboard } from "./generateUsageDashboard.js";
import { GLOBAL_OPTIONS } from "./options.js";

export const generate = defineCommand({
  meta: {
    name: "generate",
    description: "Generate Croco resources",
  },
  args: {
    ...GLOBAL_OPTIONS,
  },
  subCommands: {
    scaffold: generateScaffold,
    "usage-dashboard": generateUsageDashboard,
  },
});
