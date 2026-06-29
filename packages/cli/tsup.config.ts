import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/bin/croco.ts", "src/index.ts", "src/jobs.ts", "src/ops.ts"],
  format: ["esm"],
  clean: true,
  dts: true,
  target: "node20",
});
