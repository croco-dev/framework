import { copyFileSync, mkdirSync } from "node:fs";
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  minify: true,
  onSuccess: async () => {
    mkdirSync("dist/migrations", { recursive: true });
    copyFileSync(
      "migrations/0001_customer_explorer.up.sql",
      "dist/migrations/0001_customer_explorer.up.sql",
    );
  },
});
