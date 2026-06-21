import { defineCommand } from "citty";
import { GLOBAL_OPTIONS } from "./options.js";
import { projectMap } from "./projectMap.js";

export const project = defineCommand({
  meta: {
    name: "project",
    description: "Inspect Croco project artifacts",
  },
  args: {
    ...GLOBAL_OPTIONS,
  },
  subCommands: {
    map: projectMap,
  },
});
