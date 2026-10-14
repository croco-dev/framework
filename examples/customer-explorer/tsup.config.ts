import { defineConfig } from "tsup";
export default defineConfig({
  entry: ["src/browser.ts", "src/learningBrowser.ts"],
  format: ["iife"],
  platform: "browser",
  noExternal: [/.*/],
  define: { "process.env.NODE_ENV": '"production"' },
});
