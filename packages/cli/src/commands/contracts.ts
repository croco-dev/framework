import { defineCommand } from "citty";
import { contractsCheck } from "./contractsCheck.js";
import { GLOBAL_OPTIONS } from "./options.js";

export const contracts = defineCommand({
  meta: {
    name: "contracts",
    description: "Validate Croco contract graph artifacts",
  },
  args: {
    ...GLOBAL_OPTIONS,
  },
  subCommands: {
    check: contractsCheck,
  },
});
