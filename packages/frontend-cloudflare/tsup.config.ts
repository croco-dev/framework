import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    worker: "src/index.ts",
  },
  format: ["esm"],
  platform: "neutral",

  clean: true,
  dts: true,
  minify: true,
  outExtension: () => ({ js: ".js" }),
});
