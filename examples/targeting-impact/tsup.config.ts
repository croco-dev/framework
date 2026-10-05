import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/browser.tsx"],
  format: ["iife"],
  platform: "browser",
  noExternal: [/.*/],
  define: { "process.env.NODE_ENV": '"production"' },
});
