# @croco/presentation-preset

`@croco/presentation-preset` records the generated output contracts that back the Presentation
runtime claims in `docs/package-catalog.json`.

## Supported Runtime Profiles

The source of truth is `runtime-profiles.json`. Each profile names the runtime claim, target
metadata, output artifacts, entry descriptors, package test evidence, and generated-app smoke
case that proves the claim.

| Profile             | Catalog runtime      | Generated smoke evidence                                                              |
| ------------------- | -------------------- | ------------------------------------------------------------------------------------- |
| `node-server`       | `node`               | `CROCO_GENERATED_SMOKE_CASES=production-app-starter pnpm create-croco-app:smoke`      |
| `lambda-function`   | `lambda`             | `CROCO_GENERATED_SMOKE_CASES=graphql-lambda-api pnpm create-croco-app:smoke`          |
| `cloudflare-worker` | `cloudflare-workers` | `CROCO_GENERATED_SMOKE_CASES=meta-vite-fullstack-workers pnpm create-croco-app:smoke` |
| `browser-vite-spa`  | `browser`            | `CROCO_GENERATED_SMOKE_CASES=meta-vite-web pnpm create-croco-app:smoke`               |

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
