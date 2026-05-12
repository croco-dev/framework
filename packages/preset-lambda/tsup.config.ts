import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    handler: "src/handler.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  minify: false,
  noExternal: ["@croco/framework-preset"],
});
