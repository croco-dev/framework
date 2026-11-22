// Bundles `server.ts` for plain Node. Workspace packages resolve to their
// TypeScript sources, so the server is built like the app instead of being run
// through a TypeScript loader; a published consumer can import the packages
// directly.
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    ssr: "server.ts",
    outDir: "dist/server",
    target: "node22",
    rollupOptions: { output: { entryFileNames: "server.js" } },
  },
});
