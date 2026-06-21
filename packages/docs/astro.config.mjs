// @ts-check

import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";
import starlightTypeDoc, { typeDocSidebarGroup } from "starlight-typedoc";
import { sanitizeTypeDocIndex } from "./scripts/sanitize-typedoc-index.mjs";

function sanitizeGeneratedTypeDocIndex() {
  return {
    name: "sanitize-generated-typedoc-index",
    hooks: {
      "config:setup": async () => {
        await sanitizeTypeDocIndex();
      },
    },
  };
}

// https://astro.build/config
export default defineConfig({
  integrations: [
    starlight({
      title: "Croco Framework Documentation",
      defaultLocale: "en",
      locales: {
        en: {
          label: "English",
          lang: "en",
        },
        ko: {
          label: "한국어",
          lang: "ko",
        },
      },
      social: [{ icon: "github", label: "GitHub", href: "https://github.com/croco-dev/framework" }],
      plugins: [
        starlightTypeDoc({
          entryPoints: [
            "../admin-generated/src/index.ts",
            "../admin-ops/src/index.ts",
            "../analytics-core/src/index.ts",
            "../audit-core/src/index.ts",
            "../auth-core/src/index.ts",
            "../billing-core/src/index.ts",
            "../batch-qstash/src/index.ts",
            "../create-croco-app/src/cli.ts",
            "../dataloader-core/src/index.ts",
            "../diagnostics-core/src/index.ts",
            "../events-core/src/index.ts",
            "../events-inmemory/src/index.ts",
            "../features-core/src/index.ts",
            "../framework-context/src/index.ts",
            "../framework-preset/src/index.ts",
            "../framework-routes/src/index.ts",
            "../frontend-cloudflare/src/index.ts",
            "../frontend-react/src/index.ts",
            "../frontend-vite/src/index.ts",
            "../idempotency-core/src/index.ts",
            "../integrations-posthog/src/index.ts",
            "../invitation-core/src/index.ts",
            "../llm-core/src/index.ts",
            "../llm-openai/src/index.ts",
            "../llm-metering/src/index.ts",
            "../membership-core/src/index.ts",
            "../metering-core/src/index.ts",
            "../metering-upstash/src/index.ts",
            "../metrics-core/src/index.ts",
            "../migration-runner/src/index.ts",
            "../notifications-core/src/index.ts",
            "../openapi-spec/src/index.ts",
            "../preset-cloudflare/src/index.ts",
            "../preset-lambda/src/index.ts",
            "../preset-node/src/index.ts",
            "../problems-core/src/index.ts",
            "../protocols-core/src/index.ts",
            "../protocols-graphql/src/index.ts",
            "../protocols-rest/src/index.ts",
            "../protocols-trpc/src/index.ts",
            "../ratelimit-core/src/index.ts",
            "../ratelimit-upstash/src/index.ts",
            "../repository-core/src/index.ts",
            "../retry-core/src/index.ts",
            "../rpc-codegen/src/index.ts",
            "../search-core/src/index.ts",
            "../storage-core/src/index.ts",
            "../telemetry-api/src/index.ts",
            "../telemetry-sdk-node/src/index.ts",
            "../testing/src/index.ts",
            "../tasks-qstash/src/index.ts",
            "../transports-cloudflare-workers/src/index.ts",
            "../transports-graphql/src/index.ts",
            "../transports-http/src/index.ts",
            "../triggers-qstash/src/index.ts",
            "../tx-core/src/index.ts",
            "../tx-drizzle/src/index.ts",
            "../webhooks-core/src/index.ts",
          ],
          tsconfig: "./tsconfig.typedoc.json",
          typeDoc: {
            disableSources: true,
            excludeInternal: true,
            excludePrivate: true,
            excludeReferences: true,
            skipErrorChecking: true,
          },
          sidebar: {
            label: "API Reference",
            collapsed: false,
          },
        }),
        sanitizeGeneratedTypeDocIndex(),
      ],
      sidebar: [
        {
          label: "Guides",
          items: [
            { label: "Getting Started", slug: "guides/getting-started" },
            { label: "Architecture", slug: "guides/architecture" },
            { label: "Schema Source Of Truth", slug: "guides/schema-source-of-truth" },
            { label: "Runtime Contract", slug: "guides/runtime-contract" },
            { label: "Failure Semantics", slug: "guides/failure-semantics" },
            { label: "Deployment Recipes", slug: "guides/deployment-recipes" },
            { label: "Events Core", slug: "guides/events-core" },
            { label: "Retry Core", slug: "guides/retry-core" },
          ],
        },
        {
          label: "Reference",
          autogenerate: { directory: "reference" },
        },
        typeDocSidebarGroup,
      ],
    }),
  ],
});
