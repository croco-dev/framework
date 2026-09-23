import { crocoPlugin } from "@croco/esbuild-plugin";
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/lambda.ts"],
  format: ["cjs"],
  clean: true,
  esbuildPlugins: [crocoPlugin()],
});
