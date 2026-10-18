# Registered public page inspection

This credential-free fixture maps an in-memory product repository into a public source, the existing meta-vite buffered SSR renderer and Node adapter, an authorized admin operation and the shared inspector. There is no external fetch, database, sitemap or GSC dependency.

From the repository root:

```sh
pnpm build
pnpm --filter @croco/meta-vite test:public-pages
```

The example is application source and is bundled by the verification script using the workspace compiler. A deployed CLI config must likewise point to the built application module exporting `inspect`; source-first workspace package entrypoints are not plain Node ESM entrypoints.

The browser verification starts a loopback HTTP server and closes it afterward. Headless Chrome checks the PDP with JavaScript disabled at desktop/mobile widths, all four inspector states, declared HTTP statuses and JSON-LD script termination with JavaScript enabled. Screenshots are retained in a printed OS temporary directory.

The local `inspect` authorization permits synthetic public targets and denies `private`. Applications must replace it with their authenticated admin policy and bind tenant/site ownership before registering a target. A target supplies a fixed preview request and an in-process application handler; no caller URL is accepted or followed. No private session is attached. Product source projection, canonical mappings and public links must remain tenant safe.

The public handler resolves access/publication before rendering, loads one public snapshot per request, and sends `private, no-store`. It deliberately uses buffered SSR; it does not add public-page behavior to existing RSC, streaming, SSG or ISR routes. Existing routes retain their own contracts. Apps may compose this opt-in handler with `createMetaFetchHandler` and existing Host adapters. The three deployment profiles remain unverified for this new public-page path; local Node/Chrome evidence does not certify Kubernetes, Lambda or Workers deployment.

The example's `mismatch` target modifies a real rendered response to reproduce canonical and visible-price disagreement. CLI, admin and agent JSON report those same diagnostics. A `ready` report guarantees neither search indexing nor rank.
