import { defineConfig } from "vitest/config";

export default defineConfig({ test: { include: ["src/server/tests/**/*.spec.ts"] } });
