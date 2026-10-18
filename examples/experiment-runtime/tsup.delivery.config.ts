import { defineConfig } from "tsup";
export default defineConfig([
  {
    entry: ["src/deliveryBrowser.tsx"],
    format: ["iife"],
    platform: "browser",
    noExternal: [/.*/],
    define: { "process.env.NODE_ENV": '"production"' },
  },
  { entry: ["src/deliveryView.ts"], format: ["esm"], platform: "node", external: ["react"] },
]);
