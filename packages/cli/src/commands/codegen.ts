import { defineCommand } from "citty";
import { codegenOpenapi } from "./codegenOpenapi.js";
import { codegenRpc } from "./codegenRpc.js";
import { GLOBAL_OPTIONS } from "./options.js";

export const codegen = defineCommand({
  meta: {
    name: "codegen",
    description: "Run Croco code generators",
  },
  args: {
    ...GLOBAL_OPTIONS,
  },
  subCommands: {
    rpc: codegenRpc,
    openapi: codegenOpenapi,
  },
});
