import { createRequire } from "node:module";
import { dirname } from "node:path";
import { defineConfig } from "tsup";

const appRequire = createRequire(import.meta.url);

export default defineConfig({
  entry: ["src/browser.tsx"],
  format: ["iife"],
  platform: "browser",
  noExternal: [/.*/],
  esbuildOptions(options) {
    // Workspace packages may have different compatible dev React resolutions.
    // The rendered app and every imported component must share its hook dispatcher.
    options.alias = {
      ...options.alias,
      react: dirname(appRequire.resolve("react/package.json")),
      "react-dom": dirname(appRequire.resolve("react-dom/package.json")),
    };
  },
  define: { "process.env.NODE_ENV": '"production"' },
});
