import { Token } from "@croco/framework-context";
import { defineCrocoModule, defineCrocoPlugin } from "@croco/framework-module";
import type { CloudflareFetchEnv } from "./fetch";

export { createCloudflareWorkersHost } from "./fetch";

/** Environment bindings owned by one Worker application runtime. */
export const CLOUDFLARE_ENV_TOKEN = new Token<CloudflareFetchEnv>("CloudflareEnv");

/** Installs native bindings without selecting or certifying SaaS providers. */
export function cloudflareWorkersHost(env: CloudflareFetchEnv) {
  return defineCrocoPlugin({
    metadata: {
      name: "cloudflare-workers-host",
      packageName: "@croco/preset-cloudflare",
      maturity: "alpha",
      providedContracts: ["@croco/preset-cloudflare/CloudflareFetchEnv"],
      capabilities: [{ id: "runtime.host", kind: "single" }],
      runtimeCompatibility: ["cloudflare-workers"],
      configuration: [],
      verification: [
        {
          command: "pnpm --filter @croco/preset-cloudflare test",
          reference: "packages/preset-cloudflare/src/tests/CloudflareHostPlugin.spec.ts",
        },
      ],
      examples: ["packages/preset-cloudflare/README.md"],
    },
    modules: [
      defineCrocoModule({
        name: "@croco/preset-cloudflare/host",
        providers: [{ provide: CLOUDFLARE_ENV_TOKEN, useValue: env }],
        exports: [CLOUDFLARE_ENV_TOKEN],
      }),
    ],
  });
}
