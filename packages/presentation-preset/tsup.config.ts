import { copyFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { defineConfig } from "tsup";

const RUNTIME_PROFILES_OUTPUT_PATH = "dist/runtime-profiles.json";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  minify: false,
  sourcemap: false,
  onSuccess: async () => {
    mkdirSync(dirname(RUNTIME_PROFILES_OUTPUT_PATH), { recursive: true });
    copyFileSync("runtime-profiles.json", RUNTIME_PROFILES_OUTPUT_PATH);
  },
});
