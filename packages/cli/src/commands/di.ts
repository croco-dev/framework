import { defineCommand } from "citty";
import { diCheck } from "./diCheck.js";
import { diGraph } from "./diGraph.js";

export const di = defineCommand({
  meta: {
    name: "di",
    description: "Validate Croco DI and module graph artifacts",
  },
  subCommands: {
    check: diCheck,
    graph: diGraph,
  },
});
