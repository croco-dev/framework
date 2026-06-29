import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node22",
  clean: true,
  dts: true,
  noExternal: ["@croco/tenant-core"],
  banner: {
    js: "#!/usr/bin/env node",
  },
});
