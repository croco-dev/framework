import { createRequire } from "node:module";
import { dirname } from "node:path";
import { defineConfig } from "tsup";

const requirePackage = createRequire(import.meta.url);

export default defineConfig({
  entry: ["src/browser.tsx"],
  format: ["iife"],
  platform: "browser",
  noExternal: [/.*/],
  // Workspace sources must use the application's React singleton when bundled.
  esbuildOptions(options) {
    options.alias = {
      react: dirname(requirePackage.resolve("react/package.json")),
      "react-dom": dirname(requirePackage.resolve("react-dom/package.json")),
    };
  },
  define: { "process.env.NODE_ENV": '"production"' },
});
