import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    application: "src/application.ts",
    fetch: "src/fetch.ts",
  },
  format: ["esm"],
  dts: true,
  clean: true,
  minify: true,
  platform: "neutral",
  external: ["cloudflare:*"],
  outExtension: () => ({ js: ".mjs" }),
});
