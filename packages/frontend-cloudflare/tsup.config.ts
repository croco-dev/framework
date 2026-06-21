import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    worker: "src/index.ts",
  },
  format: ["esm", "cjs"],
  platform: "neutral",

  clean: true,
  dts: true,
  minify: true,
  outExtension: ({ format }) => ({ js: format === "cjs" ? ".cjs" : ".js" }),
});
