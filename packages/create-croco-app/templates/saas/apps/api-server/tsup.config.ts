import { crocoPlugin } from "@croco/esbuild-plugin";
import { defineConfig } from "tsup";
import { diOptions } from "./di.config";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  clean: true,
  dts: true,
  esbuildPlugins: [crocoPlugin({ di: diOptions })],
});
