# @croco/meta-vite

Croco-native Vite buffered SSR meta-framework. Croco의 유일한 SSR 엔진입니다. 모든 서버 렌더링 페이지는 `@croco/meta-vite`를 통해 제공됩니다.

## Installation

```bash
pnpm add @croco/meta-vite
```

Requires Vite `>=6.4.3 <7` and React 19+.

Redis-backed ISR is an optional integration:

```bash
pnpm add ioredis
```

## Features

- **SSR**: Server-side rendering with React 19, head metadata injection, XSS-safe HTML shell
- **`rsc` mode (real React Flight)**: official `@vitejs/plugin-rsc` encoder
  (`react-server-dom-webpack/server.node` in an isolated `react-server`
  child process) → `RenderServer.handleRsc()` decodes with the official
  `react-server-dom-webpack/client` decoder and renders HTML with
  `react-dom/server`. HTML (`/page`) and Flight (`/page.rsc` or
  `Accept: text/x-component`) are negotiated on one path with distinct
  representations (`text/html` vs `text/x-component`) and manifest-version
  headers; mismatched client manifests fail with
  `RscClientManifestMismatchProblem` (400) instead of mixing
  representations. Unsupported Flight server references fail with
  `RscServerReferenceNotSupportedProblem` (501). See
  `examples/rsc-node-example` for the Node production-build proof.
- **SSG**: Static site generation at build time (`prerenderSsgRoutes`)
- **ISR**: TTL-only incremental static regeneration via CacheStore. `InMemoryCacheStore` for local/single-process, `RedisCacheStoreAdapter` for production durable caching (extends `AbstractCacheStoreAdapter`), and runtime support diagnostics for durable production claims
- **API Co-location**: Define API routes alongside page routes with `defineApiRoute()`. Compose pages and APIs under a single fetch handler using `createMetaFetchHandler`'s `apiRoutes` option
- **Server Actions**: `createServerAction()` for form POST handling with Zod validation. `createServerActionRegistry()` scopes actions for tests, HMR, and multi-app runtimes, while `createServerActionHandler()` integrates with the `apiRoutes` dispatch pipeline
- **Route Manifest**: `createMetaViteRouteManifestFromRegistry()` emits deterministic build artifacts for page routes, API routes, server actions, component references, revalidation, and runtime capability requirements
- **Frontend Action Manifest**: `createMetaViteFrontendActionManifestFromRegistry()` emits the shared action manifest for registered server actions, declared Problems, schema references, and invalidation hints
- **Provider adapters**: Cloudflare Workers, AWS Lambda, Node.js with API-first/page-fallback composition
- **Vite 6 plugin**: `crocoMetaVitePlugin` with client/ssr environment configuration (`rsc` opt-in via `{ rsc: true }` + optional `@vitejs/plugin-rsc` peer)

## Quick Start

### 1. Define routes

```typescript
import { defineRoute, RouteRegistry } from "@croco/meta-vite";
import { RenderServer } from "@croco/meta-vite";

const registry = new RouteRegistry();
registry.register(
  defineRoute({
    path: "/",
    component: HomePage,
    mode: "ssr",
  }),
);
```

### 2. Compile and render

```typescript
const server = new RenderServer(registry.compile());
const response = await server.handle(new Request("https://example.com/"));
```

### 3. Deploy

```typescript
import { createMetaFetchHandler } from "@croco/meta-vite";

const handler = createMetaFetchHandler({
  pageHandler: server,
});

// Node: serve({ fetch: handler })
// Cloudflare: export default { fetch: handler }
// Lambda: createLambdaComposedHandler(...)
```

### 4. SSR Page + API Route (combined)

The `apiRoutes` option accepts `/api` and paths under `/api/`. Registration, route manifest
creation, and fetch handler creation reject other paths with
`CROCO_META_VITE_API_ROUTE_PREFIX_REQUIRED`, including the route path and HTTP method.
A route registered at `/api` can handle `/api/*`; a request to exactly `/api` still follows
the page handler flow. For paths outside this namespace, use the legacy `apiHandler` or
provider adapter `apiHandlers.match`.

```typescript
import {
  defineRoute,
  defineApiRoute,
  RouteRegistry,
  RenderServer,
  createMetaFetchHandler,
} from "@croco/meta-vite";

// Page route
const registry = new RouteRegistry();
registry.register(
  defineRoute({
    path: "/",
    component: HomePage,
    mode: "ssr",
  }),
);

// API routes
const apiRoutes = [
  defineApiRoute({
    path: "/api/hello",
    method: "GET",
    handler: async (request: Request): Promise<Response> => {
      return new Response(JSON.stringify({ message: "Hello from API!" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  }),
  defineApiRoute({
    path: "/api/users",
    method: "POST",
    handler: async (request: Request): Promise<Response> => {
      const body = await request.json();
      return new Response(JSON.stringify({ created: body }), { status: 201 });
    },
  }),
];

// Compose pages and APIs under a single handler
const server = new RenderServer(registry.compile());
const handler = createMetaFetchHandler({
  apiRoutes,
  pageHandler: server,
});

// /api/* → API routes, /* → SSR pages
const response = await handler(new Request("https://example.com/api/hello"));
```

### Shell-First Streaming SSR

Critical shells stream first; deferred regions resolve later through React Suspense:

```typescript no-check
import { defineRoute, RenderServer, RouteRegistry } from "@croco/meta-vite";

const registry = new RouteRegistry();
registry.register(
  defineRoute({
    path: "/pdp",
    component: ProductPage,
    mode: "ssr",
    // Decided before headers commit: 404/redirect/critical 5xx.
    resolveShell: async ({ request }) => {
      const product = await lookupProduct(request);
      if (!product) {
        return { kind: "notFound" };
      }
      return { kind: "render" };
    },
    // Non-critical regions render behind Suspense after the shell flushes.
    // Loaders receive the per-request `{ request, context, signal }` input so
    // parallel fetches and cancellation never mix tenant/auth data.
    regions: [{ id: "recommendations", loader: ({ signal }) => fetchRecommendations(signal) }],
    stream: { deadlineMs: 10_000, regionTimeoutMs: 5_000, maxBufferedBytes: 65_536 },
  }),
);

const server = new RenderServer(registry.compile());
```

Delivery is host-driven: Node and Cloudflare pipe the shell-first stream;
Lambda buffers the complete HTML before returning (`x-croco-delivery` reports
`stream` or `buffered`). After headers commit, region errors keep a safe
fallback and are observed through `console.error`; status is never rewritten
and stacks never leak. Shell streams carry only safe aggregates in
`Server-Timing: shell;dur=0, regions`.

`streaming-response` is reported in the route manifest only for SSR pages with
declared regions. Plain SSR pages remain on the buffered render path.

## Route Manifest

Use the route manifest build helper when CI, docs, deployment tooling, or admin surfaces need a
stable artifact instead of runtime reflection:

```typescript
import {
  createMetaViteRouteManifestFromRegistry,
  serializeMetaViteRouteManifest,
} from "@croco/meta-vite";

const manifest = createMetaViteRouteManifestFromRegistry({
  routeRegistry: registry,
  serverActionRegistry,
});

const json = serializeMetaViteRouteManifest(manifest);
```

Stable public contract fields are `schemaVersion`, page `path`, `mode`, `componentRef`,
`revalidateMs`, page `runtimeCapabilities`, page `runtimeRequirements`, API route `path` and
`method`, and server action `name`, `path`, `method`, declared input/output schema presence, and
declared Problem contracts. `order` fields are diagnostic canonical-sort evidence and should not
be used as a routing API. Handler functions, React components, and Zod schema objects are not
serialized into the manifest. Page routes without `componentRef` fail manifest generation with
`CROCO_META_VITE_ROUTE_MANIFEST_COMPONENT_REF_REQUIRED`.

## Frontend Action Manifest

Use the frontend action manifest when generated apps, CI, or LLM tooling need to inspect what
server actions can do without importing runtime handlers:

```typescript
import {
  createMetaViteFrontendActionManifestFromRegistry,
  writeMetaViteFrontendActionManifest,
} from "@croco/meta-vite";

const manifest = createMetaViteFrontendActionManifestFromRegistry({
  serverActionRegistry,
});

await writeMetaViteFrontendActionManifest(manifest, "dist/frontend-action-manifest.json");
```

When the same workspace also generates REST RPC actions, pass this manifest through
`GenerateClientOptions.frontendActionManifestInputs` and let `@croco/rpc-codegen` write the one
combined artifact. The RPC codegen README contains the complete single-writer example.

Server actions can declare cache invalidation hints that are emitted to both the route manifest and
the shared `croco.frontend-action-manifest.v1` artifact:

```typescript
createServerAction({
  name: "signup",
  invalidates: [{ kind: "query-key-prefix", target: "session", reason: "signup accepted" }],
  handler: async () => ({ ok: true, data: { ok: true } }),
});
```

Use `checkMetaViteFrontendActionManifestFile()` in CI to compare a committed manifest with the
current server-action registry without rewriting the file.

## Route Modes

| Mode | Description                                                                                                         | Revalidate             |
| ---- | ------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| ssr  | Server-side render every request                                                                                    | N/A                    |
| ssg  | Static pre-render at build time                                                                                     | N/A                    |
| isr  | TTL-based revalidation with CacheStore                                                                              | `revalidate` (seconds) |
| rsc  | Real React Flight encode → SSR decode → HTML stream; negotiated Flight bytes on `.rsc` / `Accept: text/x-component` | N/A                    |

`mode` records the requested route mode. `runtimeCapabilities` records the implementation's
capabilities; `rsc` routes report Flight-backed rendering (`react-server-components`
through the official encoder/decoder pair). Its
`runtimeRequirements` retains the requested React Server Components requirement, which the
Flight implementation satisfies via the supported `@vitejs/plugin-rsc@0.5.26` +
`react-server-dom-webpack@19.2.5` stack (React/ReactDOM 19.2.5; see the pinned
lockfile entries and `examples/rsc-node-example/scripts/check-versions.mjs`).
A `Response` body alone does not prove progressive rendering.

Profiles requiring page capabilities must pass `requiredCapabilities` to
`createMetaViteRouteManifest()` or `createMetaViteRouteManifestFromRegistry()`.
For example, `requiredCapabilities: ["react-server-components", "streaming-response"]`
fails before manifest emission with `MetaViteUnsupportedCapabilityProblem`
(`meta-vite/unsupported-render-capability`, status 501, route path and capability extensions).
Omitting requirements keeps the declared Flight implementation; it does not certify
streaming beyond the Flight→SSR decode path in `RenderServer`. The Node
production-build proof lives in `examples/rsc-node-example` (#2835); SSR
shell-first streaming shipped in #2836.
Adapter preservation of externally supplied streams is a separate capability from page rendering.

## Provider Adapters

- **Cloudflare**: `createCloudflareComposedHandler({ apiHandlers, pageHandler })` — API-first, page fallback. Uses `RuntimeContext.platform: 'cloudflare'`.
- **Lambda**: `createLambdaComposedHandler({ apiHandlers, pageHandler })` — API Gateway v2/v1 event conversion. Response is buffered (no streaming).
- **Node**: `createNodeComposedHandler({ apiHandlers, pageHandler })` — Returns `{ fetch }` for `@hono/node-server` or Node.js `http.createServer`.

## Production Runtime Matrix

Detailed promotion gates live in [Presentation Runtime Support](../docs/src/content/docs/en/reference/presentation-runtime-support.md). The package-level support contract is:

| Capability        | Node                                                                                                                                                                                 | Lambda                                                                                                    | Cloudflare Workers                                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| SSR pages         | Supported through `createNodeComposedHandler()` and `RenderServer`.                                                                                                                  | Supported through `createLambdaComposedHandler()` with API Gateway event conversion.                      | Supported through `createCloudflareComposedHandler()` and `@croco/frontend-cloudflare`.                 |
| SSG routes        | Supported at build time through `prerenderSsgRoutes()`.                                                                                                                              | Supported before Lambda packaging as static output.                                                       | Supported before Worker asset upload as static output.                                                  |
| ISR routes        | v1 exact-key TTL. Use `RedisCacheStoreAdapter` or another durable `IsrCacheStore` for production persistence.                                                                        | v1 exact-key TTL. In-memory cache is warm-container only; use durable storage for production persistence. | v1 exact-key TTL only when a Worker-safe `IsrCacheStore` is supplied. In-memory cache is isolate-local. |
| RSC routes        | Real React Flight (`@vitejs/plugin-rsc@0.5.26` + `react-server-dom-webpack@19.2.5`, React 19.2.5) on Node; HTML/Flight negotiated per request. Example: `examples/rsc-node-example`. | Buffered RSC path not verified on Lambda — declare only after a real host-contract check.                 | Buffered RSC path not verified on Workers — declare only after a real host-contract check.              |
| Server actions    | Supported through `createServerActionHandler()`.                                                                                                                                     | Supported after Lambda request conversion.                                                                | Supported with Cloudflare `RuntimeContext` propagation.                                                 |
| API routes        | API-first/page-fallback composition.                                                                                                                                                 | API-first/page-fallback composition.                                                                      | API-first/page-fallback composition or Worker service bindings.                                         |
| Streaming         | Fetch `Response` streams are preserved by the fetch surface.                                                                                                                         | Not supported by this adapter; responses are buffered.                                                    | Supported for streaming `Response` bodies.                                                              |
| Cache persistence | In-memory is local/single-process only; Redis is the shipped durable adapter.                                                                                                        | In-memory is warm-container only; Redis is the shipped durable adapter.                                   | No shipped durable Worker cache adapter. Supply a Worker-safe store before claiming durable ISR.        |

Smoke evidence: `pnpm --filter @croco/meta-vite test` covers durable Node and Lambda ISR through
`RedisCacheStoreAdapter`, Workers durable-claim boundaries, in-memory local-only behavior, cacheable
request rules, `2xx`-only response caching, and `getOrSet()` singleflight behavior.

## ISR v1 Contract

`@croco/meta-vite` intentionally keeps ISR v1 as exact-key TTL caching:

- cacheable requests are `GET` or `HEAD` without `Authorization` or `Cookie`;
- only `2xx` responses are cached;
- concurrent same-key misses rely on the cache store's `getOrSet()` singleflight behavior;
- `InMemoryCacheStore` is for local, development, or single-process deployments only;
- `RedisCacheStoreAdapter` is the shipped durable adapter for Node and Lambda;
- `createDurableIsrCacheProfile()` only reports non-local stores as durable; known `InMemoryCacheStore`
  instances remain local and produce durable-claim diagnostics;
- `evaluateIsrRuntimeSupport()` returns deterministic diagnostics before a deployment claims durable ISR;
- pattern invalidation is available only through durable adapters that explicitly expose it, such as the Redis adapter.

### Durable ISR Readiness

Use runtime support profiles before enabling production durable ISR:

```typescript
import { RedisCacheStoreAdapter } from "@croco/meta-vite/isr/adapters";
import { createDurableIsrCacheProfile, evaluateIsrRuntimeSupport } from "@croco/meta-vite";

const cache = createDurableIsrCacheProfile(new RedisCacheStoreAdapter(redis), {
  label: "RedisCacheStoreAdapter",
});
const report = evaluateIsrRuntimeSupport({
  runtime: "node",
  cache,
  requireDurable: true,
});

if (!report.supported) {
  throw new Error(report.diagnostics.map((diagnostic) => diagnostic.code).join(", "));
}
```

Recovery diagnostics:

| Code                                      | Meaning                                                                                | Recovery                                                                                    |
| ----------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `CROCO_META_VITE_ISR_LOCAL_CACHE_ONLY`    | The configured cache is local to one process, warm container, or Worker isolate.       | Use `RedisCacheStoreAdapter` on Node/Lambda, or a durable runtime-safe store for Workers.   |
| `CROCO_META_VITE_ISR_WORKER_STORE_UNSAFE` | A durable Workers ISR claim was requested with a store that is not marked Worker-safe. | Supply a Worker-safe `IsrCacheStore` backed by Worker-compatible bindings and mark it safe. |

## Limitations (v1)

- **React-only**: v1 supports React 19+ only. No Vue/Svelte support.
- **Vite >=6.4.3 <7**: Requires the Vite 6 Environment API and the patched Windows filesystem deny behavior.
- **ISR non-durable by default**: InMemoryCacheStore is local/dev/single-process. Production Redis ISR uses the optional `ioredis` peer and the `@croco/meta-vite/isr/adapters` entrypoint.
- **Cloudflare streaming**: Cloudflare Workers support streaming Response bodies, but InMemory ISR is not durable across Worker isolates.
- **RSC scope**: Node production-build path is proven by `examples/rsc-node-example`
  (server-only data + interactive client island + async Suspense boundary; secret-leak
  check in its README). Workers/Lambda RSC support stays undeclared until verified
  against a real host contract.
- **RSC dev mode**: RSC routes require full reload during development. HMR-based RSC updates are deferred.

## Diagnostics

Common errors and their diagnostics:

- **Server-only leakage**: Importing `node:fs` or other server-only modules from a `'use client'` boundary produces an explicit error with the module path. This validation scans imported module specifiers and reports which server-only modules leaked across a client boundary.
- **Invalid route**: Registration rejects a missing or invalid `component` with `CROCO_META_VITE_ROUTE_COMPONENT_REQUIRED` and an unsupported mode with `CROCO_META_VITE_ROUTE_MODE_UNSUPPORTED`. Components must be functions or non-null objects (including React `memo` and `forwardRef` components). Both errors include the route path. Direct manifest creation also rejects unsupported modes.
- **Invalid ISR revalidate**: Registration rejects NaN, ±Infinity, negative `revalidate`, and values that overflow when converted to milliseconds with `CROCO_META_VITE_ROUTE_REVALIDATE_INVALID` and the route path. Zero and finite positive fractions are allowed. Direct manifest creation rejects non-finite or negative `revalidateMs`. `revalidate` without `mode: 'isr'` remains silently ignored by rendering.
- **Missing durable ISR configuration**: `evaluateIsrRuntimeSupport({ requireDurable: true })` reports `CROCO_META_VITE_ISR_LOCAL_CACHE_ONLY` for local-only stores and `CROCO_META_VITE_ISR_WORKER_STORE_UNSAFE` for Workers stores that are not explicitly Worker-safe.
- **RSC rendering failure**: Returns a JSON diagnostic `{ error: 'RSC rendering failed', route: string, detail: string }` with status 500. For `Error` values, `detail` is redacted to `An internal server error occurred`. Distinct non-500 cases: missing encoder → 501 `RSC request not supported` (`meta-vite/rsc-flight-not-acceptable`); client-manifest mismatch → 400 `RSC client manifest mismatch` (`meta-vite/rsc-client-manifest-mismatch`); missing client reference → 400 `RSC client reference missing` (`meta-vite/rsc-client-reference-missing`); unsupported server reference → 501 `RSC request not supported` (`meta-vite/rsc-server-reference-unsupported`).
- **Render error (SSR)**: SSR rendering errors fall back to a generic `500 Internal Server Error` HTML response. Error details are not included in the HTML to prevent server-side information leakage.
- **Route not found**: Unmatched routes return a `404 Not Found` HTML response.

## Public API

### Route Definitions

| Export          | Type     | Description                                                                                      |
| --------------- | -------- | ------------------------------------------------------------------------------------------------ |
| `defineRoute`   | function | Register a flat code-based page route. Returns the same definition for build plugin consumption. |
| `RouteRegistry` | class    | Stores route definitions and compiles them into render-ready intermediate representation.        |
| `head`          | function | Define page-level head metadata (title, description, canonical URL).                             |

### Render Core

| Export                   | Type     | Description                                                                                      |
| ------------------------ | -------- | ------------------------------------------------------------------------------------------------ |
| `RenderServer`           | class    | Core SSR/RSC render engine. Accepts compiled routes and a Web Fetch Request, returns a Response. |
| `createMetaFetchHandler` | function | Fetch-based handler factory with API-first fallback composition.                                 |
| `CrocoFetchHandler`      | type     | `(request: Request, context?: RuntimeContext) => Promise<Response>`                              |
| `RuntimeContext`         | type     | Provider-neutral context with `platform`, `env`, `executionContext`, `event`, `lambdaContext`.   |

### ISR

Redis adapter exports are published from `@croco/meta-vite/isr/adapters`:

```typescript
import { RedisCacheStoreAdapter } from "@croco/meta-vite/isr/adapters";
```

| Export                         | Type     | Description                                                                                                                          |
| ------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `createIsrMiddleware`          | function | CacheStore-backed ISR middleware wrapping a fetch-style render function.                                                             |
| `createIsrHandler`             | function | Legacy ISR handler with string-based API and `IsrCacheAdapter`.                                                                      |
| `createLocalIsrCacheProfile`   | function | Marks an `IsrCacheStore` as local-only for runtime support reporting.                                                                |
| `createDurableIsrCacheProfile` | function | Builds a durable profile for non-local stores; known in-memory stores remain local for runtime support reporting.                    |
| `evaluateIsrRuntimeSupport`    | function | Returns deterministic support diagnostics before a deployment claims durable ISR.                                                    |
| `IsrCacheAdapter`              | type     | Cache adapter contract with `getOrSet` and `invalidate`.                                                                             |
| `IsrCacheStore`                | type     | `CacheStore<string, Response>` subset for ISR middleware.                                                                            |
| `IsrCacheStoreProfile`         | type     | Runtime support profile for local or durable ISR cache stores.                                                                       |
| `IsrRuntimeSupportReport`      | type     | Runtime ISR support result with durable claim status and diagnostics.                                                                |
| `AbstractCacheStoreAdapter`    | class    | Subpath export. Abstract base class implementing `IsrCacheStore.getOrSet`. Subclasses implement `_get`, `_set`, `_delete`.           |
| `RedisCacheStoreAdapter`       | class    | Subpath export. Redis-backed ISR cache adapter extending `AbstractCacheStoreAdapter`. Requires `ioredis`, supports TTL and patterns. |

### API Routes

| Export               | Type     | Description                                                                                                                      |
| -------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `defineApiRoute`     | function | Register an API route with path, HTTP method, and fetch-style handler. Returns the same definition for build plugin consumption. |
| `ApiRouteDefinition` | type     | `{ path: string; method?: ApiMethod; handler: (request: Request, context?: RuntimeContext) => Promise<Response> }`               |
| `ApiRouteHandler`    | type     | `(request: Request, context?: RuntimeContext) => Promise<Response>`                                                              |
| `ApiMethod`          | type     | `'GET' \| 'POST' \| 'PUT' \| 'DELETE' \| 'PATCH'`                                                                                |

### Server Actions

| Export                              | Type     | Description                                                                                                                                                                                                                                 |
| ----------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ServerActionRegistry`              | class    | Isolated action registry with `register`, `unregister`, `clear`, and `dispatch` methods for app, test, or HMR lifecycle scoping.                                                                                                            |
| `createServerActionRegistry`        | function | Create an isolated `ServerActionRegistry` instance.                                                                                                                                                                                         |
| `createServerAction`                | function | Register a server action with name, optional Zod schema, and handler. Defaults to the global registry and throws on duplicate name.                                                                                                         |
| `createServerActionHandler`         | function | Returns an `{ path, method, handler }` object for `POST /api/action/:name`. Accepts a registry instance, optional `allowedOrigins` (mismatched `Origin` → 403 `meta-vite/server-action-forbidden-origin`), and integrates with `apiRoutes`. |
| `createServerActionSuccess`         | function | Build a typed success result body, `{ ok: true, data }`, for handlers that want the action result contract instead of a custom `Response`.                                                                                                  |
| `createServerActionSuccessResponse` | function | Build an `application/json` response containing a typed success result.                                                                                                                                                                     |
| `dispatchServerAction`              | function | Low-level dispatch by action name. Accepts `FormData` or plain object, validates against registered schema. Failures return Problem JSON.                                                                                                   |
| `resetServerActions`                | function | Clear all actions from the global registry by default, or from a supplied registry.                                                                                                                                                         |
| `unregisterServerAction`            | function | Remove one action from the global registry by default, or from a supplied registry.                                                                                                                                                         |
| `ServerActionConfig`                | type     | `{ name: string; schema?: ZodSchema<TInput>; output?: ServerActionOutputContract<TOutput>; problems?: ServerActionProblemContract[]; handler }`                                                                                             |
| `ServerActionContractIR`            | type     | Serializable server action contract used by the route manifest builder.                                                                                                                                                                     |
| `ServerActionResult`                | type     | Typed action result union: `{ ok: true, data }` or RFC 7807 Problem details with `{ ok: false, kind }`.                                                                                                                                     |

Server action failures use a stable action result contract. Missing actions, invalid paths, invalid
content types, validation failures, disallowed origins, and thrown Croco `Problem` instances return
`application/problem+json` with top-level RFC 7807 fields plus `ok: false` and `kind`. Server action
calls are multipart: send `FormData` (`multipart/form-data` or
`application/x-www-form-urlencoded`). JSON POST bodies are rejected with
`meta-vite/server-action-invalid-content-type` (415). Pass
`createServerActionHandler(registry, { allowedOrigins: ["https://app.example"] })` to enforce
per-call origin checks; mismatched origins fail with
`meta-vite/server-action-forbidden-origin` (403, `kind: "forbidden_origin"`) instead of
dispatching the registered action.

```typescript
import { createServerAction, createServerActionSuccess } from "@croco/meta-vite";
import { z } from "zod";

createServerAction({
  name: "signup",
  schema: z.object({ email: z.string().email() }),
  output: { description: "Signup result" },
  problems: [{ code: "auth/signup-closed", status: 422 }],
  handler: async (data) => createServerActionSuccess({ email: data.email }),
});
```

Migration note: handlers that already return `Response` still work for successful actions. Consumers that
previously read failure bodies as `{ code: "ACTION_NOT_FOUND" }` or `{ code: "VALIDATION_ERROR", fields }`
should now read the Problem result shape: `ok === false`, `kind`, RFC 7807 fields (`type`, `title`,
`status`, `code`, `detail`), and validation `fields` when `kind === "validation"`.

### SSG

| Export                | Type     | Description                                                          |
| --------------------- | -------- | -------------------------------------------------------------------- |
| `prerenderSsgRoutes`  | function | Filter and pre-render all `mode: 'ssg'` routes at build time.        |
| `renderRouteToString` | function | Default render function: loads component and calls `renderToString`. |

### Route Manifest

| Export                                    | Type     | Description                                                                                             |
| ----------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------- |
| `createMetaViteRouteManifest`             | function | Build a deterministic manifest from explicit page, API, and server action IR arrays.                    |
| `createMetaViteRouteManifestFromRegistry` | function | Build a deterministic manifest from `RouteRegistry` and optional `ServerActionRegistry`.                |
| `serializeMetaViteRouteManifest`          | function | Serialize a route manifest as stable pretty JSON with a trailing newline.                               |
| `writeMetaViteRouteManifest`              | function | Write the serialized manifest to disk, creating parent directories when needed.                         |
| `MetaViteRouteManifestError`              | class    | Error thrown when route metadata cannot produce a stable manifest contract.                             |
| `MetaViteRouteManifest`                   | type     | Stable route manifest artifact shape.                                                                   |
| `MetaViteRuntimeCapability`               | type     | Implemented route capabilities; buffered pages report `react-ssr`, without Flight or streaming support. |
| `MetaViteRuntimeRequirement`              | type     | Build/runtime requirement codes for SSG, ISR, and RSC routes.                                           |

### Vite Plugin

| Export                | Type     | Description                                                                             |
| --------------------- | -------- | --------------------------------------------------------------------------------------- |
| `crocoMetaVitePlugin` | function | Vite 6 plugin that configures client/ssr environments (rsc opt-in) and virtual modules. |

### Output Contract

| Export                      | Type     | Description                                                   |
| --------------------------- | -------- | ------------------------------------------------------------- |
| `createMetaOutputContract`  | function | Create an output contract for meta-framework build artifacts. |
| `MetaDeployTarget`          | type     | Deploy target descriptor.                                     |
| `MetaOutputContractOptions` | type     | Options for output contract creation.                         |

### Provider Adapters

| Export                            | Type     | Description                                        |
| --------------------------------- | -------- | -------------------------------------------------- |
| `createCloudflareHandler`         | function | Cloudflare Workers adapter (single handler).       |
| `createCloudflareComposedHandler` | function | Cloudflare Workers adapter with API-first routing. |
| `createLambdaHandler`             | function | AWS Lambda adapter (single handler).               |
| `createLambdaComposedHandler`     | function | AWS Lambda adapter with API-first routing.         |
| `createNodeHandler`               | function | Node.js adapter returning `{ fetch }`.             |
| `createNodeComposedHandler`       | function | Node.js adapter with API-first routing.            |

## Development

```bash
pnpm build --filter=@croco/meta-vite
pnpm test --filter=@croco/meta-vite
pnpm typecheck --filter=@croco/meta-vite
```

## License

Apache-2.0
