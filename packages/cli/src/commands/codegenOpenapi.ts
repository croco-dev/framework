import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { basename, dirname, join } from "node:path";
import { defineCommand } from "citty";
import { GLOBAL_OPTIONS } from "./options.js";

const require = createRequire(import.meta.url);

export const codegenOpenapi = defineCommand({
  meta: {
    name: "openapi",
    description: "Generate OpenAPI documents",
  },
  args: {
    ...GLOBAL_OPTIONS,
  },
  run() {
    runOpenapiSpec(process.argv.slice(3));
  },
});

function runOpenapiSpec(args: string[]): void {
  const child = spawn(resolveOpenapiSpecBin(), args, {
    stdio: "inherit",
    shell: true,
  });

  child.on("error", (error) => {
    throw error;
  });
  child.on("exit", (code) => {
    process.exitCode = code ?? 1;
  });
}

function resolveOpenapiSpecBin(): string {
  const entry = require.resolve("@croco/openapi-spec");
  const entryDir = dirname(entry);

  return basename(entryDir) === "src"
    ? join(dirname(entryDir), "dist", "cli.js")
    : join(entryDir, "cli.js");
}
