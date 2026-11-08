import { crocoPlugin } from "@croco/esbuild-plugin";
import { defineConfig } from "tsup";
import { workerDiOptions } from "./worker.di.config";

export default defineConfig({
  entry: ["src/worker.ts"],
  format: ["esm"],
  platform: "browser",
  outExtension: () => ({ js: ".mjs" }),
  clean: true,
  dts: true,
  esbuildPlugins: [crocoPlugin({ di: workerDiOptions })],
});
