import { build } from "esbuild";
await build({
  entryPoints: ["src/worker.ts"],
  outfile: "dist/worker.mjs",
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  loader: { ".graphql": "text" },
  external: ["node:async_hooks", "node:crypto"],
  conditions: ["workerd", "worker", "browser"],
});
