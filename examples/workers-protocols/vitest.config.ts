import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
export default defineConfig({
  resolve: {
    alias: {
      "@croco/protocols-graphql/fetch": fileURLToPath(
        new URL("../../packages/protocols-graphql/src/fetch.ts", import.meta.url),
      ),
      "@croco/transports-graphql/fetch": fileURLToPath(
        new URL("../../packages/transports-graphql/src/fetch.ts", import.meta.url),
      ),
      graphql: fileURLToPath(new URL("./node_modules/graphql/index.js", import.meta.url)),
    },
  },
});
