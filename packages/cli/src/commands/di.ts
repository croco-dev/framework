import { defineCommand } from "citty";
import { diCheck } from "./diCheck.js";

export const di = defineCommand({
  meta: {
    name: "di",
    description: "Validate Croco DI and module graph artifacts",
  },
  subCommands: {
    check: diCheck,
  },
});
