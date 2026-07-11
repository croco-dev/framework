# @croco/presentation-preset

`@croco/presentation-preset` records the generated output contracts that back the Presentation
runtime claims in `docs/package-catalog.json`.

## Frontend Action Manifest

The package also defines the shared `FrontendActionManifest` JSON contract used by generated
frontend surfaces. The schema version is `croco.frontend-action-manifest.v1`.

Each action entry records:

- stable `id` and source metadata (`rest-rpc-route` or `meta-vite-server-action`)
- HTTP `method` and `path`
- input and output shape references (`generated-type`, `declared-schema`, or `none`)
- declared Problem metadata
- available permission metadata (`guards`, `roles`, `entitlements`)
- cache invalidation hints such as query-key prefixes

Use `serializeFrontendActionManifest()` for byte-stable JSON, `writeFrontendActionManifest()` to
write build artifacts, and `checkFrontendActionManifestFile()` in CI to fail on committed manifest
drift without rewriting the file.

## Supported Runtime Profiles

The source of truth is `runtime-profiles.json`. Each profile names the runtime claim, target
metadata, output artifacts, entry descriptors, package test evidence, and generated-app smoke
case that proves the claim.

| Profile                   | Catalog runtime      | Generated smoke evidence                                                              |
| ------------------------- | -------------------- | ------------------------------------------------------------------------------------- |
| `node-server`             | `node`               | `CROCO_GENERATED_SMOKE_CASES=production-app-starter pnpm create-croco-app:smoke`      |
| `lambda-function`         | `lambda`             | `CROCO_GENERATED_SMOKE_CASES=graphql-lambda-api pnpm create-croco-app:smoke`          |
| `cloudflare-worker`       | `cloudflare-workers` | `CROCO_GENERATED_SMOKE_CASES=meta-vite-fullstack-workers pnpm create-croco-app:smoke` |
| `browser-vite-spa`        | `browser`            | `CROCO_GENERATED_SMOKE_CASES=graphql-vite-spa-docker pnpm create-croco-app:smoke`     |
| `browser-vite-spa-astryx` | `browser`            | `CROCO_GENERATED_SMOKE_CASES=graphql-vite-spa-astryx pnpm create-croco-app:smoke`     |

The Astryx profile uses Astryx's prebuilt CSS exports, so generated Vite applications do not need
a StyleX compiler plugin. It remains a beta opt-in profile; the provider-neutral Vite profile is
still available through `--ui none`, and omitted `--ui` values retain the legacy generator output.

## Verification

Run the package-level contract check:

```bash
pnpm --filter @croco/presentation-preset test
```

Run the generated-app smoke matrix when a profile, generated output shape, or runtime claim
changes:

```bash
pnpm create-croco-app:smoke
pnpm docs:catalog:check
```

`pnpm docs:catalog:check` fails when `docs/package-catalog.json` claims a
`@croco/presentation-preset` runtime that lacks generated profile evidence in
`runtime-profiles.json`.
