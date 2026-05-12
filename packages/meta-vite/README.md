# @croco/meta-vite

Croco-native Vite SSR/RSC meta-framework. Croco의 유일한 SSR 엔진입니다. 모든 서버 렌더링 페이지는 `@croco/meta-vite`를 통해 제공됩니다.

## Installation

```bash
pnpm add @croco/meta-vite
```

Requires Vite 6+ and React 19+.

## Features

- **SSR**: Server-side rendering with React 19, head metadata injection, XSS-safe HTML shell
- **RSC**: React Server Components with Flight payload embedding and browser hydration
- **SSG**: Static site generation at build time (`prerenderSsgRoutes`)
- **ISR**: TTL-only incremental static regeneration via CacheStore. `InMemoryCacheStore` for local/single-process, `RedisCacheStoreAdapter` for production durable caching (extends `AbstractCacheStoreAdapter`)
- **API Co-location**: Define API routes alongside page routes with `defineApiRoute()`. Compose pages and APIs under a single fetch handler using `createMetaFetchHandler`'s `apiRoutes` option
- **Server Actions**: `createServerAction()` for form POST handling with Zod validation. `createServerActionHandler()` integrates with the `apiRoutes` dispatch pipeline
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

### 4. SSR Page + API Route (combined)

```typescript
import { defineRoute, defineApiRoute, RouteRegistry, RenderServer, createMetaFetchHandler } from '@croco/meta-vite';

// Page route
const registry = new RouteRegistry();
registry.register(defineRoute({
  path: '/',
  component: HomePage,
  mode: 'ssr',
}));

// API routes
const apiRoutes = [
  defineApiRoute({
    path: '/api/hello',
    method: 'GET',
    handler: async (request: Request): Promise<Response> => {
      return new Response(JSON.stringify({ message: 'Hello from API!' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  }),
  defineApiRoute({
    path: '/api/users',
    method: 'POST',
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
const response = await handler(new Request('https://example.com/api/hello'));
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
| `AbstractCacheStoreAdapter` | class | Abstract base class implementing `IsrCacheStore.getOrSet`. Subclasses implement `_get`, `_set`, `_delete`. |
| `RedisCacheStoreAdapter` | class | Redis-backed ISR cache adapter extending `AbstractCacheStoreAdapter`. Uses ioredis, supports TTL and pattern-based `invalidatePattern()`. |

### API Routes

| Export | Type | Description |
|--------|------|-------------|
| `defineApiRoute` | function | Register an API route with path, HTTP method, and fetch-style handler. Returns the same definition for build plugin consumption. |
| `ApiRouteDefinition` | type | `{ path: string; method?: ApiMethod; handler: (request: Request) => Promise<Response> }` |
| `ApiMethod` | type | `'GET' \| 'POST' \| 'PUT' \| 'DELETE' \| 'PATCH'` |

### Server Actions

| Export | Type | Description |
|--------|------|-------------|
| `createServerAction` | function | Register a server action with name, optional Zod schema, and handler. Throws on duplicate name. |
| `createServerActionHandler` | function | Returns an `{ path, method, handler }` object for `POST /api/action/:name`. Integrates with `apiRoutes` dispatch. |
| `dispatchServerAction` | function | Low-level dispatch by action name. Accepts `FormData` or plain object, validates against registered schema. Returns 404 or 400 JSON on failure. |
| `ServerActionConfig` | type | `{ name: string; schema?: ZodSchema<T>; handler: (data: T, context?: RuntimeContext) => Promise<Response> \| Response }` |

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
