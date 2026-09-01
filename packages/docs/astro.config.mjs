// @ts-check

import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import starlightTypeDoc, { typeDocSidebarGroup } from "starlight-typedoc";

import { prepareApiModelEntryPoints } from "./scripts/prepare-api-models.mjs";
import { sanitizeGeneratedTypeDocIndex } from "./scripts/sanitize-typedoc-index.mjs";

const isolatedBuildRoot = process.env.CROCO_DOCS_BUILD_ROOT;
const apiOnlyBuild = process.env.CROCO_DOCS_API_ONLY === "1";
const preparedApiModelRoot = isolatedBuildRoot
  ? join(isolatedBuildRoot, "typedoc-models")
  : fileURLToPath(new URL("./.turbo/docs-api/merge-inputs", import.meta.url));
const preparedApiModelEntryPoints = await prepareApiModelEntryPoints(preparedApiModelRoot);
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

const guidesSidebar = {
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
};
const referenceSidebar = {
  label: "Reference",
  items: [{ autogenerate: { directory: "reference" } }],
};

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
          entryPoints: preparedApiModelEntryPoints,
          typeDoc: {
            name: "croco",
            entryPointStrategy: "merge",
            disableSources: true,
            excludeInternal: true,
            excludePrivate: true,
            excludeReferences: true,
            skipErrorChecking: true,
            locales: {
              en: {
                theme_default_value: "Default value",
                theme_default_type: "Default type",
                theme_description: "Description",
                theme_event: "Event",
                theme_re_exports: "Re-exports",
                theme_renames_and_re_exports: "Renames and re-exports",
                theme_extends: "Extends",
                theme_extended_by: "Extended by",
                theme_globals: "Globals",
                theme_member: "Member",
                theme_member_plural: "Members",
                theme_modifier: "Modifier",
                theme_name: "Name",
                theme_package: "Package",
                theme_packages: "Packages",
                theme_type: "Type",
                theme_union_members: "Union Members",
                theme_value: "Value",
                theme_version: "Version",
              },
            },
          },
          sidebar: {
            label: "API Reference",
            collapsed: false,
          },
        }),
        sanitizeGeneratedTypeDocIndex(),
      ],
      sidebar: apiOnlyBuild
        ? [typeDocSidebarGroup]
        : [guidesSidebar, referenceSidebar, typeDocSidebarGroup],
    }),
  ],
});
