import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["examples/data.config.ts"],
  format: ["esm"],
  target: "node22",
  outDir: ".turbo/data-example",
  noExternal: [/^@croco\//],
  clean: true,
});
