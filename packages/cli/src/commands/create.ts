import { defineCommand } from "citty";
import { createDomain } from "./createDomain.js";
import { createPage } from "./createPage.js";
import { GLOBAL_OPTIONS } from "./options.js";

export const create = defineCommand({
  meta: {
    name: "create",
    description: "Create Croco project files",
  },
  args: {
    ...GLOBAL_OPTIONS,
  },
  subCommands: {
    page: createPage,
    domain: createDomain,
  },
});
