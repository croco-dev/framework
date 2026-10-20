import { defineConfig } from "vite";
export default defineConfig({
  build: { target: "es2022", manifest: true, rollupOptions: { input: "src/browser.tsx" } },
});
