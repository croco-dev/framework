// Vite loads this config with Node (not the browser bundler), and the
// workspace dev entrypoint of `@croco/meta-vite` is authored for the bundler,
// so the plugin source is imported by path: Vite bundles it into the loaded
// config instead of handing the TypeScript entry to Node.
import { crocoMetaVitePlugin } from "../../packages/meta-vite/src/libs/vite/crocoMetaVitePlugin";
import vitePluginRsc from "@vitejs/plugin-rsc";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    // `rsc: true` enables the Flight environments and makes the plugin record
    // the client build id (`dist/client/croco-rsc-client-build.json`), which
    // `serve.mjs` uses as the manifest version the browser has to echo back.
    crocoMetaVitePlugin({ rsc: true }),
    vitePluginRsc({
      entries: {
        client: "./src/entry.browser.tsx",
        ssr: "./src/entry.ssr.tsx",
        rsc: "./src/entry.rsc.tsx",
      },
    }),
  ],
});
