import { defineConfig } from "tsup";

export default defineConfig({
  noExternal: ["@croco/etl-core"],
});
