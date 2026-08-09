import { defineCommand } from "citty";
import { GLOBAL_OPTIONS } from "./options.js";
import { testPlan } from "./testPlan.js";

export const test = defineCommand({
  meta: {
    name: "test",
    description: "Plan Croco test execution from executable assurance artifacts",
  },
  args: {
    ...GLOBAL_OPTIONS,
  },
  subCommands: {
    plan: testPlan,
  },
});
