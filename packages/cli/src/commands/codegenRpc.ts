import { defineCommand } from "citty";
import { spawn } from "node:child_process";
import { GLOBAL_OPTIONS } from "./options.js";

export const codegenRpc = defineCommand({
  meta: {
    name: "rpc",
    description: "Generate RPC clients",
  },
  args: {
    ...GLOBAL_OPTIONS,
  },
  run() {
    const binPath = require.resolve("@croco/rpc-codegen");
    const child = spawn(binPath, process.argv.slice(3), {
      stdio: "inherit",
      shell: true,
    });

    child.on("exit", (code) => {
      process.exit(code ?? 1);
    });

    child.on("error", (err) => {
      console.error(err.message);
      process.exit(1);
    });
  },
});
