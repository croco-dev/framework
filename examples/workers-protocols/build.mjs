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
  alias: {
    "@croco/preset-cloudflare/fetch": "../../packages/preset-cloudflare/src/fetch.ts",
    "@croco/protocols-graphql/fetch": "../../packages/protocols-graphql/src/fetch.ts",
    "@croco/transports-graphql/fetch": "../../packages/transports-graphql/src/fetch.ts",
  },
});
