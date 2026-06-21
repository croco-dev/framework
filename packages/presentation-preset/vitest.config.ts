import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@croco/diagnostics-core": resolve(__dirname, "../diagnostics-core/src/index.ts"),
      "@croco/events-core": resolve(__dirname, "../events-core/src/index.ts"),
      "@croco/framework-context": resolve(__dirname, "../framework-context/src/index.ts"),
      "@croco/framework-logger": resolve(__dirname, "../framework-logger/src/index.ts"),
      "@croco/framework-preset": resolve(__dirname, "../framework-preset/src/index.ts"),
      "@croco/health-core": resolve(__dirname, "../health-core/src/index.ts"),
      "@croco/preset-cloudflare": resolve(__dirname, "../preset-cloudflare/src/index.ts"),
      "@croco/preset-cloudflare/src/fetch": resolve(__dirname, "../preset-cloudflare/src/fetch.ts"),
      "@croco/preset-lambda": resolve(__dirname, "../preset-lambda/src/index.ts"),
      "@croco/preset-node": resolve(__dirname, "../preset-node/src/index.ts"),
      "@croco/problems-core": resolve(__dirname, "../problems-core/src/index.ts"),
      "@croco/protocols-core": resolve(__dirname, "../protocols-core/src/index.ts"),
      "@croco/protocols-rest": resolve(__dirname, "../protocols-rest/src/index.ts"),
      "@croco/ratelimit-core": resolve(__dirname, "../ratelimit-core/src/index.ts"),
      "@croco/transports-http": resolve(__dirname, "../transports-http/src/index.ts"),
    },
  },
  test: {
    include: ["src/**/*.spec.ts"],
  },
});
