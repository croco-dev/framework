import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["examples/agent-read/setup.mjs"],
  outDir: "examples/agent-read/dist",
  format: ["esm"],
  target: "node20",
  clean: true,
  noExternal: [
    "@croco/rpc-codegen",
    "@croco/protocol-codegen",
    "@croco/protocols-core",
    "reflect-metadata",
  ],
});
