---
title: Presentation Runtime Support
description: Production readiness matrix for Croco presentation packages and runtime adapters.
---

# Presentation Runtime Support

Presentation maturity is evidence-based. A package can have package tests and still remain alpha
when runtime-specific smoke, deployment output validation, diagnostics, or documented recovery
paths are incomplete.

## Runtime Matrix

| Capability        | Node                                                                                                                     | Lambda                                                                                                                                                           | Cloudflare Workers                                                                                                                           |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| SSR pages         | Supported through `createNodeComposedHandler()` and `RenderServer`.                                                      | Supported through `createLambdaComposedHandler()` with API Gateway event conversion.                                                                             | Supported through `createCloudflareComposedHandler()` and `@croco/frontend-cloudflare`.                                                      |
| SSG routes        | Supported at build time through `prerenderSsgRoutes()`.                                                                  | Supported as static build output before Lambda packaging.                                                                                                        | Supported as static build output before Worker asset upload.                                                                                 |
| ISR routes        | Supported as v1 exact-key TTL caching. Durable ISR requires `RedisCacheStoreAdapter` or another durable `IsrCacheStore`. | Supported as v1 exact-key TTL caching. In-memory cache is warm-container only; durable ISR requires `RedisCacheStoreAdapter` or another durable `IsrCacheStore`. | Supported as v1 exact-key TTL caching only when a Worker-safe `IsrCacheStore` is supplied. In-memory cache is isolate-local and not durable. |
| RSC routes        | Beta. React 19 RSC payload rendering and server-only leakage tests exist; HMR-based RSC reload is deferred.              | Beta, buffered by the Lambda adapter. No Lambda streaming claim.                                                                                                 | Beta. Workers can return streaming `Response` bodies, but RSC dev reload remains full reload.                                                |
| Server actions    | Supported through `createServerActionHandler()` in the API route pipeline.                                               | Supported through the same handler after Lambda event conversion.                                                                                                | Supported through the same handler with Cloudflare `RuntimeContext` propagation.                                                             |
| API routes        | Supported through `defineApiRoute()` and API-first/page-fallback composition.                                            | Supported through API-first/page-fallback composition.                                                                                                           | Supported through API-first/page-fallback composition or Cloudflare service bindings.                                                        |
| Streaming         | Fetch `Response` bodies are preserved by the fetch-compatible Node surface.                                              | Not supported by this adapter; Lambda responses are buffered.                                                                                                    | Supported for fetch `Response` bodies; tested as a Worker-style stream preservation claim.                                                   |
| Cache persistence | In-memory is local/single-process only. Redis is the shipped durable adapter.                                            | In-memory is warm-container only. Redis is the shipped durable adapter.                                                                                          | No shipped durable Worker cache adapter. Use a Worker-safe external `IsrCacheStore` before claiming durable ISR.                             |

Runtime ISR smoke evidence lives in `packages/meta-vite/src/tests/isr-runtime-support.spec.ts`.
Run it through `pnpm --filter @croco/meta-vite test`; the smoke covers Redis-backed durable ISR on
Node and Lambda, Workers durable-claim rejection without a Worker-safe store, and local-only
in-memory cache isolation.

## ISR v1 Contract

`@croco/meta-vite` keeps ISR v1 as exact-key TTL caching. The stable contract is:

- cacheable requests are `GET` or `HEAD` without `Authorization` or `Cookie`;
- only `2xx` responses are cached;
- concurrent same-key misses use the cache store's `getOrSet()` singleflight semantics;
- `InMemoryCacheStore` is local, development, or single-process only;
- `RedisCacheStoreAdapter` is the shipped durable adapter for Node and Lambda deployments;
- `createDurableIsrCacheProfile()` does not upgrade known `InMemoryCacheStore` instances into a durable profile;
- `evaluateIsrRuntimeSupport()` reports deterministic durable-claim diagnostics before runtime boot;
- pattern invalidation is available only through durable adapters that explicitly expose it, such as the Redis adapter.

## Durable ISR Recovery

Missing durable ISR configuration is not treated as a silent production success:

| Diagnostic code                           | Trigger                                                                                          | Recovery                                                                                    |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `CROCO_META_VITE_ISR_LOCAL_CACHE_ONLY`    | A deployment requires durable ISR while using a local process, warm-container, or isolate cache. | Use `RedisCacheStoreAdapter` on Node/Lambda, or a durable runtime-safe store for Workers.   |
| `CROCO_META_VITE_ISR_WORKER_STORE_UNSAFE` | A Cloudflare Workers durable ISR claim uses a store profile that is not marked Worker-safe.      | Supply a Worker-safe `IsrCacheStore` backed by Worker-compatible bindings and mark it safe. |

RSC development recovery remains conservative: render failures return controlled diagnostics, and
development reload recovery is a full page reload rather than an HMR-based RSC recovery claim.

## Promotion Criteria

Presentation packages move from alpha to beta only after all package-specific criteria are met:

| Package                      | Current result    | Beta gate                                                                                                                                                                                                                                                                                                                |
| ---------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@croco/frontend-react`      | Promoted to beta. | Package tests cover page data/meta hooks and the meta-vite helper boundary. Generated `meta-vite-fullstack-workers` smoke proves browser hydration, page data flow, and visible hydration mismatch failure. Production-ready still requires broader app-entry/bootstrap coverage beyond one generated fullstack profile. |
| `@croco/frontend-vite`       | Promoted to beta. | Package tests cover Vite helper output and optional Cloudflare peer diagnostics. Generated smoke now covers SPA browser build output plus meta-vite web/fullstack build and presentation smoke.                                                                                                                          |
| `@croco/frontend-cloudflare` | Promoted to beta. | Worker SSR is covered by package tests and `meta-vite-fullstack-workers` generated-app smoke for service-binding API routing, asset fallback, streaming response preservation, env/context propagation, and clear failure behavior.                                                                                      |
| `@croco/meta-vite`           | Remains beta.     | Durable ISR runtime smoke now covers Node/Lambda/Workers claim boundaries. Production-ready still requires generated-profile output contract validation across every supported profile and stronger RSC development recovery than the documented full reload path.                                                       |
| `@croco/presentation-preset` | Remains beta.     | Production-ready requires generated output contract validation for every supported runtime profile and no untested runtime capability claim in the package catalog.                                                                                                                                                      |

No presentation package should be promoted in `docs/package-catalog.json` unless its gate evidence is named
in the relevant package README, package tests, generated-app smoke, and this page.

## Presentation Preset Evidence

`@croco/presentation-preset` keeps the current generated runtime profile contract in
`packages/presentation-preset/runtime-profiles.json`. The package test command validates each
profile's target metadata, output entries, artifacts, contract format, generated smoke case, and
the runtime claims currently listed in `docs/package-catalog.json`.

| Profile             | Runtime              | Generated smoke case          |
| ------------------- | -------------------- | ----------------------------- |
| `node-server`       | `node`               | `production-app-starter`      |
| `lambda-function`   | `lambda`             | `graphql-lambda-api`          |
| `cloudflare-worker` | `cloudflare-workers` | `meta-vite-fullstack-workers` |
| `browser-vite-spa`  | `browser`            | `graphql-vite-spa-docker`     |

Verification commands:

```bash
pnpm --filter @croco/presentation-preset test
pnpm create-croco-app:smoke
pnpm docs:catalog:check
```
