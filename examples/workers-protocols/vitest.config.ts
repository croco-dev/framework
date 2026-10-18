import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
export default defineConfig({
  resolve: {
    alias: { graphql: fileURLToPath(new URL("./node_modules/graphql/index.js", import.meta.url)) },
  },
});
