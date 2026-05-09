# @croco/meta-vite

Croco-native Vite SSR/RSC meta-framework.

## Installation

```bash
pnpm add @croco/meta-vite
```

Requires Vite 6+ and React 19+.

## Features

- **SSR**: Server-side rendering with React 19, head metadata injection, XSS-safe HTML shell
- **RSC**: React Server Components with Flight payload embedding and browser hydration
- **SSG**: Static site generation at build time (`prerenderSsgRoutes`)
- **ISR**: TTL-only incremental static regeneration via CacheStore
- **Provider adapters**: Cloudflare Workers, AWS Lambda, Node.js with API-first/page-fallback composition
- **Vite 6 plugin**: `crocoMetaVitePlugin` with client/ssr/rsc environment configuration

## Quick Start

### 1. Define routes

```typescript
import { defineRoute, RouteRegistry } from '@croco/meta-vite';
import { RenderServer } from '@croco/meta-vite';

const registry = new RouteRegistry();
registry.register(defineRoute({
  path: '/',
  component: HomePage,
  mode: 'ssr',
}));
```

### 2. Compile and render

```typescript
const server = new RenderServer(registry.compile());
const response = await server.handle(new Request('https://example.com/'));
```

### 3. Deploy

```typescript
import { createMetaFetchHandler } from '@croco/meta-vite';

const handler = createMetaFetchHandler({
  pageHandler: server,
});

// Node: serve({ fetch: handler })
// Cloudflare: export default { fetch: handler }
// Lambda: createLambdaComposedHandler(...)
```

## Route Modes

| Mode | Description | Revalidate |
|------|-------------|------------|
| ssr  | Server-side render every request | N/A |
| ssg  | Static pre-render at build time | N/A |
| isr  | TTL-based revalidation with CacheStore | `revalidate` (seconds) |
| rsc  | React Server Components with Flight payload | N/A |

## Provider Adapters

- **Cloudflare**: `createCloudflareComposedHandler({ apiHandlers, pageHandler })` — API-first, page fallback. Uses `RuntimeContext.platform: 'cloudflare'`.
- **Lambda**: `createLambdaComposedHandler({ apiHandlers, pageHandler })` — API Gateway v2/v1 event conversion. Response is buffered (no streaming).
- **Node**: `createNodeComposedHandler({ apiHandlers, pageHandler })` — Returns `{ fetch }` for `@hono/node-server` or Node.js `http.createServer`.

## Limitations (v1)

- **React-only**: v1 supports React 19+ only. No Vue/Svelte support.
- **Vite 6+**: Requires Vite 6 Environment API. Older Vite versions not supported.
- **ISR non-durable**: InMemoryCacheStore is local/dev/single-process. Production durable ISR (KV, Redis, S3) requires a custom adapter.
- **Cloudflare streaming**: Cloudflare Workers support streaming Response bodies, but InMemory ISR is not durable across Worker isolates.
- **RSC dev mode**: RSC routes require full reload during development. HMR-based RSC updates are deferred.
- **No API co-location**: `/api` route co-location with page routes is deferred. Use existing Croco REST/RPC controllers with `createMetaFetchHandler` for composition.
- **No Server Actions framework**: Minimal RSC server action validation exists; full Server Actions abstraction is deferred.

## Diagnostics

Common errors and their diagnostics:

- **Server-only leakage**: Importing `node:fs` or other server-only modules from a `'use client'` boundary produces an explicit error with the module path. This validation scans imported module specifiers and reports which server-only modules leaked across a client boundary.
- **Invalid route**: Route without a `component` field or with an unsupported mode produces an error. The route path is included in the diagnostic.
- **Invalid ISR revalidate**: `revalidate` without `mode: 'isr'` is silently ignored. A `revalidate` value that is not a positive integer produces a validation warning.
- **RSC rendering failure**: Returns a JSON diagnostic `{ error: 'RSC rendering failed', route: string, detail: string }` with status 500. The `detail` field contains the original error message from the React render call.
- **Render error (SSR)**: SSR rendering errors fall back to a generic `500 Internal Server Error` HTML response. Error details are not included in the HTML to prevent server-side information leakage.
- **Route not found**: Unmatched routes return a `404 Not Found` HTML response.

## Public API

### Route Definitions

| Export | Type | Description |
|--------|------|-------------|
| `defineRoute` | function | Register a flat code-based page route. Returns the same definition for build plugin consumption. |
| `RouteRegistry` | class | Stores route definitions and compiles them into render-ready intermediate representation. |
| `head` | function | Define page-level head metadata (title, description, canonical URL). |

### Render Core

| Export | Type | Description |
|--------|------|-------------|
| `RenderServer` | class | Core SSR/RSC render engine. Accepts compiled routes and a Web Fetch Request, returns a Response. |
| `createMetaFetchHandler` | function | Fetch-based handler factory with API-first fallback composition. |
| `CrocoFetchHandler` | type | `(request: Request, context?: RuntimeContext) => Promise<Response>` |
| `RuntimeContext` | type | Provider-neutral context with `platform`, `env`, `executionContext`, `event`, `lambdaContext`. |

### ISR

| Export | Type | Description |
|--------|------|-------------|
| `createIsrMiddleware` | function | CacheStore-backed ISR middleware wrapping a fetch-style render function. |
| `createIsrHandler` | function | Legacy ISR handler with string-based API and `IsrCacheAdapter`. |
| `IsrCacheAdapter` | type | Cache adapter contract with `getOrSet` and `invalidate`. |
| `IsrCacheStore` | type | `CacheStore<string, Response>` subset for ISR middleware. |

### SSG

| Export | Type | Description |
|--------|------|-------------|
| `prerenderSsgRoutes` | function | Filter and pre-render all `mode: 'ssg'` routes at build time. |
| `renderRouteToString` | function | Default render function: loads component and calls `renderToString`. |

### Vite Plugin

| Export | Type | Description |
|--------|------|-------------|
| `crocoMetaVitePlugin` | function | Vite 6 plugin that configures client/ssr/rsc environments and virtual modules. |

### Output Contract

| Export | Type | Description |
|--------|------|-------------|
| `createMetaOutputContract` | function | Create an output contract for meta-framework build artifacts. |
| `MetaDeployTarget` | type | Deploy target descriptor. |
| `MetaOutputContractOptions` | type | Options for output contract creation. |

### Provider Adapters

| Export | Type | Description |
|--------|------|-------------|
| `createCloudflareHandler` | function | Cloudflare Workers adapter (single handler). |
| `createCloudflareComposedHandler` | function | Cloudflare Workers adapter with API-first routing. |
| `createLambdaHandler` | function | AWS Lambda adapter (single handler). |
| `createLambdaComposedHandler` | function | AWS Lambda adapter with API-first routing. |
| `createNodeHandler` | function | Node.js adapter returning `{ fetch }`. |
| `createNodeComposedHandler` | function | Node.js adapter with API-first routing. |

## Development

```bash
pnpm build --filter=@croco/meta-vite
pnpm test --filter=@croco/meta-vite
pnpm typecheck --filter=@croco/meta-vite
```

## License

MIT
