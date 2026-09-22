import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    "bin/croco": "src/bin/croco.ts",
    index: "src/index.ts",
    jobs: "src/jobs.ts",
    ops: "src/ops.ts",
  },
  format: ["esm"],
  clean: true,
  dts: true,
  noExternal: [
    "@croco/problems-core",
    "@croco/protocols-core",
    "reflect-metadata",
    "zod",
    "zod/v4/core",
  ],
  target: "node20",
});
