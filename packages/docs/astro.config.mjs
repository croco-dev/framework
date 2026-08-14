// @ts-check

import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import starlightTypeDoc, { typeDocSidebarGroup } from "starlight-typedoc";
import { sanitizeTypeDocIndex } from "./scripts/sanitize-typedoc-index.mjs";

const isolatedBuildRoot = process.env.CROCO_DOCS_BUILD_ROOT;
const isolatedDirectories = isolatedBuildRoot
  ? {
      srcDir: join(isolatedBuildRoot, "src"),
      publicDir: join(isolatedBuildRoot, "public"),
      outDir: join(isolatedBuildRoot, "dist"),
      cacheDir: join(isolatedBuildRoot, "cache"),
      vite: {
        resolve: {
          alias: {
            "@astrojs/starlight/loaders": fileURLToPath(
              import.meta.resolve("@astrojs/starlight/loaders"),
            ),
            "@astrojs/starlight/schema": fileURLToPath(
              import.meta.resolve("@astrojs/starlight/schema"),
            ),
          },
        },
      },
    }
  : {};

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
  ...isolatedDirectories,
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
            "../access-core/src/index.ts",
            "../access-drizzle/src/index.ts",
            "../admin-core/src/index.ts",
            "../admin-generated/src/index.ts",
            "../admin-ops/src/index.ts",
            "../admin-react/src/index.ts",
            "../analytics-core/src/index.ts",
            "../analytics-posthog/src/index.ts",
            "../architecture-policy/src/index.ts",
            "../audit-core/src/index.ts",
            "../audit-drizzle/src/index.ts",
            "../auth-better-auth/src/index.ts",
            "../auth-clerk/src/index.ts",
            "../auth-core/src/index.ts",
            "../auth-drizzle/src/index.ts",
            "../batch-core/src/index.ts",
            "../billing-core/src/index.ts",
            "../billing-polar/src/index.ts",
            "../batch-qstash/src/index.ts",
            "../cache-core/src/index.ts",
            "../cli/src/index.ts",
            "../create-croco-app/src/cli.ts",
            "../credits-core/src/index.ts",
            "../credits-drizzle/src/index.ts",
            "../customer-health-core/src/index.ts",
            "../customer-health-drizzle/src/index.ts",
            "../dataloader-core/src/index.ts",
            "../diagnostics-core/src/index.ts",
            "../entitlements-core/src/index.ts",
            "../entitlements-drizzle/src/index.ts",
            "../esbuild-plugin/src/index.ts",
            "../events-core/src/index.ts",
            "../events-inmemory/src/index.ts",
            "../events-tx/src/index.ts",
            "../execution-core/src/index.ts",
            "../execution-drizzle/src/index.ts",
            "../engagement-core/src/index.ts",
            "../features-core/src/index.ts",
            "../features-posthog/src/index.ts",
            "../framework-config/src/index.ts",
            "../framework-context/src/index.ts",
            "../framework-logger/src/index.ts",
            "../framework-module/src/index.ts",
            "../framework-preset/src/index.ts",
            "../framework-routes/src/index.ts",
            "../frontend-cloudflare/src/index.ts",
            "../frontend-problems/src/index.ts",
            "../frontend-react/src/index.ts",
            "../frontend-vite/src/index.ts",
            "../gid-core/src/index.ts",
            "../governance-core/src/index.ts",
            "../health-core/src/index.ts",
            "../idempotency-core/src/index.ts",
            "../impersonation-core/src/index.ts",
            "../integrations-posthog/src/index.ts",
            "../invitation-core/src/index.ts",
            "../invitation-drizzle/src/index.ts",
            "../lifecycle-core/src/index.ts",
            "../llm-core/src/index.ts",
            "../llm-openai/src/index.ts",
            "../llm-metering/src/index.ts",
            "../membership-core/src/index.ts",
            "../membership-drizzle/src/index.ts",
            "../meta-vite/src/index.ts",
            "../metering-core/src/index.ts",
            "../metering-drizzle/src/index.ts",
            "../metering-upstash/src/index.ts",
            "../metrics-billing/src/index.ts",
            "../metrics-core/src/index.ts",
            "../migration-runner/src/index.ts",
            "../notifications-core/src/index.ts",
            "../notifications-react-email/src/index.ts",
            "../notifications-resend/src/index.ts",
            "../onboarding-core/src/index.ts",
            "../onboarding-drizzle/src/index.ts",
            "../openapi-spec/src/index.ts",
            "../outbox-core/src/index.ts",
            "../pagination-core/src/index.ts",
            "../presentation-preset/src/index.ts",
            "../preset-cloudflare/src/index.ts",
            "../preset-lambda/src/index.ts",
            "../preset-node/src/index.ts",
            "../problems-core/src/index.ts",
            "../protocols-core/src/index.ts",
            "../protocols-desktop/src/index.ts",
            "../protocols-graphql/src/index.ts",
            "../protocols-rest/src/index.ts",
            "../protocols-trpc/src/index.ts",
            "../ratelimit-core/src/index.ts",
            "../ratelimit-upstash/src/index.ts",
            "../repository-core/src/index.ts",
            "../retry-core/src/index.ts",
            "../rpc-codegen/src/index.ts",
            "../search-core/src/index.ts",
            "../search-drizzle/src/index.ts",
            "../search-meilisearch/src/index.ts",
            "../storage-cloudflare/src/index.ts",
            "../storage-cloudinary/src/index.ts",
            "../storage-core/src/index.ts",
            "../storage-r2/src/index.ts",
            "../telemetry-api/src/index.ts",
            "../telemetry-sdk-node/src/index.ts",
            "../testing/src/index.ts",
            "../testing-resources/src/index.ts",
            "../tasks-core/src/index.ts",
            "../tasks-qstash/src/index.ts",
            "../tenant-core/src/index.ts",
            "../transports-cloudflare-workers/src/index.ts",
            "../transports-graphql/src/index.ts",
            "../transports-http/src/index.ts",
            "../triggers-core/src/index.ts",
            "../triggers-qstash/src/index.ts",
            "../tx-core/src/index.ts",
            "../tx-drizzle/src/index.ts",
            "../ui-astryx/src/index.ts",
            "../webhooks-core/src/index.ts",
            "../workflow-core/src/index.ts",
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
      sidebar: isolatedBuildRoot
        ? [typeDocSidebarGroup]
        : [
            {
              label: "Guides",
              items: [
                { label: "Getting Started", slug: "guides/getting-started" },
                { label: "Architecture", slug: "guides/architecture" },
                { label: "Schema Source Of Truth", slug: "guides/schema-source-of-truth" },
                { label: "Runtime Contract", slug: "guides/runtime-contract" },
                { label: "Reliability Path RFC", slug: "guides/reliability-path-rfc" },
                { label: "Failure Semantics", slug: "guides/failure-semantics" },
                { label: "Deployment Recipes", slug: "guides/deployment-recipes" },
                { label: "Events Core", slug: "guides/events-core" },
                { label: "Retry Core", slug: "guides/retry-core" },
              ],
            },
            {
              label: "Reference",
              items: [{ autogenerate: { directory: "reference" } }],
            },
            typeDocSidebarGroup,
          ],
    }),
  ],
});
