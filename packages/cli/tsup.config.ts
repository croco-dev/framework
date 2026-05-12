import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/bin/croco.ts", "src/index.ts"],
  format: ["esm"],
  clean: true,
  dts: false,
  target: "node20",
});
