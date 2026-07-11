import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/verification.ts"],
  format: ["esm"],
  target: "node22",
  clean: true,
  dts: true,
  noExternal: ["@croco/framework-context", "@croco/tenant-core"],
  banner: {
    js: "#!/usr/bin/env node",
  },
});
