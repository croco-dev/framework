# @croco/meta-vite

Croco-native Vite SSR/RSC meta-framework. Croco의 유일한 SSR 엔진입니다. 모든 서버 렌더링 페이지는 `@croco/meta-vite`를 통해 제공됩니다.

## Installation

```bash
pnpm add @croco/meta-vite
```

Requires Vite 6+ and React 19+.

Redis-backed ISR is an optional integration:

```bash
pnpm add ioredis
```

## Features

- **SSR**: Server-side rendering with React 19, head metadata injection, XSS-safe HTML shell
- **RSC**: React Server Components with Flight payload embedding and browser hydration
- **SSG**: Static site generation at build time (`prerenderSsgRoutes`)
- **ISR**: TTL-only incremental static regeneration via CacheStore. `InMemoryCacheStore` for local/single-process, `RedisCacheStoreAdapter` for production durable caching (extends `AbstractCacheStoreAdapter`), and runtime support diagnostics for durable production claims
- **API Co-location**: Define API routes alongside page routes with `defineApiRoute()`. Compose pages and APIs under a single fetch handler using `createMetaFetchHandler`'s `apiRoutes` option
- **Server Actions**: `createServerAction()` for form POST handling with Zod validation. `createServerActionRegistry()` scopes actions for tests, HMR, and multi-app runtimes, while `createServerActionHandler()` integrates with the `apiRoutes` dispatch pipeline
- **Route Manifest**: `createMetaViteRouteManifestFromRegistry()` emits deterministic build artifacts for page routes, API routes, server actions, component references, revalidation, and runtime capability requirements
- **Frontend Action Manifest**: `createMetaViteFrontendActionManifestFromRegistry()` emits the shared action manifest for registered server actions, declared Problems, schema references, and invalidation hints
- **Provider adapters**: Cloudflare Workers, AWS Lambda, Node.js with API-first/page-fallback composition
- **Vite 6 plugin**: `crocoMetaVitePlugin` with client/ssr/rsc environment configuration

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

| Mode | Description                                 | Revalidate             |
| ---- | ------------------------------------------- | ---------------------- |
| ssr  | Server-side render every request            | N/A                    |
| ssg  | Static pre-render at build time             | N/A                    |
| isr  | TTL-based revalidation with CacheStore      | `revalidate` (seconds) |
| rsc  | React Server Components with Flight payload | N/A                    |

## Provider Adapters

- **Cloudflare**: `createCloudflareComposedHandler({ apiHandlers, pageHandler })` — API-first, page fallback. Uses `RuntimeContext.platform: 'cloudflare'`.
- **Lambda**: `createLambdaComposedHandler({ apiHandlers, pageHandler })` — API Gateway v2/v1 event conversion. Response is buffered (no streaming).
- **Node**: `createNodeComposedHandler({ apiHandlers, pageHandler })` — Returns `{ fetch }` for `@hono/node-server` or Node.js `http.createServer`.

## Production Runtime Matrix

Detailed promotion gates live in [Presentation Runtime Support](../docs/src/content/docs/en/reference/presentation-runtime-support.md). The package-level support contract is:

| Capability        | Node                                                                                                          | Lambda                                                                                                    | Cloudflare Workers                                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| SSR pages         | Supported through `createNodeComposedHandler()` and `RenderServer`.                                           | Supported through `createLambdaComposedHandler()` with API Gateway event conversion.                      | Supported through `createCloudflareComposedHandler()` and `@croco/frontend-cloudflare`.                 |
| SSG routes        | Supported at build time through `prerenderSsgRoutes()`.                                                       | Supported before Lambda packaging as static output.                                                       | Supported before Worker asset upload as static output.                                                  |
| ISR routes        | v1 exact-key TTL. Use `RedisCacheStoreAdapter` or another durable `IsrCacheStore` for production persistence. | v1 exact-key TTL. In-memory cache is warm-container only; use durable storage for production persistence. | v1 exact-key TTL only when a Worker-safe `IsrCacheStore` is supplied. In-memory cache is isolate-local. |
| RSC routes        | Beta with React 19.                                                                                           | Beta and buffered; no streaming claim.                                                                    | Beta with Worker `Response` streaming; development reload remains full reload.                          |
| Server actions    | Supported through `createServerActionHandler()`.                                                              | Supported after Lambda request conversion.                                                                | Supported with Cloudflare `RuntimeContext` propagation.                                                 |
| API routes        | API-first/page-fallback composition.                                                                          | API-first/page-fallback composition.                                                                      | API-first/page-fallback composition or Worker service bindings.                                         |
| Streaming         | Fetch `Response` streams are preserved by the fetch surface.                                                  | Not supported by this adapter; responses are buffered.                                                    | Supported for streaming `Response` bodies.                                                              |
| Cache persistence | In-memory is local/single-process only; Redis is the shipped durable adapter.                                 | In-memory is warm-container only; Redis is the shipped durable adapter.                                   | No shipped durable Worker cache adapter. Supply a Worker-safe store before claiming durable ISR.        |

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
- **Vite 6+**: Requires Vite 6 Environment API. Older Vite versions not supported.
- **ISR non-durable by default**: InMemoryCacheStore is local/dev/single-process. Production Redis ISR uses the optional `ioredis` peer and the `@croco/meta-vite/isr/adapters` entrypoint.
- **Cloudflare streaming**: Cloudflare Workers support streaming Response bodies, but InMemory ISR is not durable across Worker isolates.
- **RSC dev mode**: RSC routes require full reload during development. HMR-based RSC updates are deferred.

## Diagnostics

Common errors and their diagnostics:

- **Server-only leakage**: Importing `node:fs` or other server-only modules from a `'use client'` boundary produces an explicit error with the module path. This validation scans imported module specifiers and reports which server-only modules leaked across a client boundary.
- **Invalid route**: Route without a `component` field or with an unsupported mode produces an error. The route path is included in the diagnostic.
- **Invalid ISR revalidate**: `revalidate` without `mode: 'isr'` is silently ignored. A `revalidate` value that is not a positive integer produces a validation warning.
- **Missing durable ISR configuration**: `evaluateIsrRuntimeSupport({ requireDurable: true })` reports `CROCO_META_VITE_ISR_LOCAL_CACHE_ONLY` for local-only stores and `CROCO_META_VITE_ISR_WORKER_STORE_UNSAFE` for Workers stores that are not explicitly Worker-safe.
- **RSC rendering failure**: Returns a JSON diagnostic `{ error: 'RSC rendering failed', route: string, detail: string }` with status 500. The `detail` field contains the original error message from the React render call.
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

| Export                              | Type     | Description                                                                                                                                     |
| ----------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `ServerActionRegistry`              | class    | Isolated action registry with `register`, `unregister`, `clear`, and `dispatch` methods for app, test, or HMR lifecycle scoping.                |
| `createServerActionRegistry`        | function | Create an isolated `ServerActionRegistry` instance.                                                                                             |
| `createServerAction`                | function | Register a server action with name, optional Zod schema, and handler. Defaults to the global registry and throws on duplicate name.             |
| `createServerActionHandler`         | function | Returns an `{ path, method, handler }` object for `POST /api/action/:name`. Accepts a registry instance and integrates with `apiRoutes`.        |
| `createServerActionSuccess`         | function | Build a typed success result body, `{ ok: true, data }`, for handlers that want the action result contract instead of a custom `Response`.      |
| `createServerActionSuccessResponse` | function | Build an `application/json` response containing a typed success result.                                                                         |
| `dispatchServerAction`              | function | Low-level dispatch by action name. Accepts `FormData` or plain object, validates against registered schema. Failures return Problem JSON.       |
| `resetServerActions`                | function | Clear all actions from the global registry by default, or from a supplied registry.                                                             |
| `unregisterServerAction`            | function | Remove one action from the global registry by default, or from a supplied registry.                                                             |
| `ServerActionConfig`                | type     | `{ name: string; schema?: ZodSchema<TInput>; output?: ServerActionOutputContract<TOutput>; problems?: ServerActionProblemContract[]; handler }` |
| `ServerActionContractIR`            | type     | Serializable server action contract used by the route manifest builder.                                                                         |
| `ServerActionResult`                | type     | Typed action result union: `{ ok: true, data }` or RFC 7807 Problem details with `{ ok: false, kind }`.                                         |

Server action failures use a stable action result contract. Missing actions, invalid paths, validation
failures, and thrown Croco `Problem` instances return `application/problem+json` with top-level RFC 7807
fields plus `ok: false` and `kind`.

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

| Export                                    | Type     | Description                                                                              |
| ----------------------------------------- | -------- | ---------------------------------------------------------------------------------------- |
| `createMetaViteRouteManifest`             | function | Build a deterministic manifest from explicit page, API, and server action IR arrays.     |
| `createMetaViteRouteManifestFromRegistry` | function | Build a deterministic manifest from `RouteRegistry` and optional `ServerActionRegistry`. |
| `serializeMetaViteRouteManifest`          | function | Serialize a route manifest as stable pretty JSON with a trailing newline.                |
| `writeMetaViteRouteManifest`              | function | Write the serialized manifest to disk, creating parent directories when needed.          |
| `MetaViteRouteManifestError`              | class    | Error thrown when route metadata cannot produce a stable manifest contract.              |
| `MetaViteRouteManifest`                   | type     | Stable route manifest artifact shape.                                                    |
| `MetaViteRuntimeCapability`               | type     | Runtime-neutral capability hints such as `isr-cache` and `react-server-components`.      |
| `MetaViteRuntimeRequirement`              | type     | Build/runtime requirement codes for SSG, ISR, and RSC routes.                            |

### Vite Plugin

| Export                | Type     | Description                                                                    |
| --------------------- | -------- | ------------------------------------------------------------------------------ |
| `crocoMetaVitePlugin` | function | Vite 6 plugin that configures client/ssr/rsc environments and virtual modules. |

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

MIT
