import { defineConfig } from "vite";

// The production server is bundled next to the app build and runs on plain Node.
export default defineConfig({
  build: {
    ssr: "src/server.ts",
    outDir: "dist/server",
    target: "node22",
    rollupOptions: { output: { entryFileNames: "server.js" } },
  },
});
