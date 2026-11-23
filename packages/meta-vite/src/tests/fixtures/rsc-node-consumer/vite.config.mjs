import vitePluginRsc from "@vitejs/plugin-rsc";
import { defineConfig } from "vite";
import { crocoMetaVitePlugin } from "@croco/meta-vite";

export default defineConfig({
  esbuild: { jsx: "automatic" },
  plugins: [
    crocoMetaVitePlugin({ rsc: true }),
    vitePluginRsc({
      entries: {
        client: "./src/entry.browser.jsx",
        ssr: "./src/entry.ssr.jsx",
        rsc: "./src/entry.rsc.jsx",
      },
    }),
  ],
});
