import { defineConfig } from "vite";
import vitePluginRsc from "@vitejs/plugin-rsc";

export default defineConfig({
  plugins: [
    vitePluginRsc({
      entries: {
        client: "./src/entry.browser.tsx",
        ssr: "./src/entry.ssr.tsx",
        rsc: "./src/entry.rsc.tsx",
      },
    }),
  ],
});
