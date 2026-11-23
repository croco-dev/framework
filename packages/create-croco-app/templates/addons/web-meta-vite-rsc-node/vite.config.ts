import { crocoMetaVitePlugin } from "@croco/meta-vite";
import vitePluginRsc from "@vitejs/plugin-rsc";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    // Records the client build id the server checks Flight requests against.
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
