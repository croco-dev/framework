---
"@croco/meta-vite": minor
"create-croco-app": minor
"@croco/problems-core": patch
---

Serve `@vitejs/plugin-rsc` production builds on Node through the public meta-vite adapter (#4064).

`loadRscBuild({ outDir })` loads a production build into a worker thread of its own and validates
it at startup. Pass the result to `new RenderServer(build.routes, { build })`. RSC routes then render
through the built `rsc` and `ssr` entries in that worker, with no process spawned per request.
plugin-rsc registers its module loaders on `globalThis`, so the per-build worker is what lets several
apps' builds share one process without resolving each other's modules. The `RuntimeContext` must be
plain data, the request body is not carried, and `head()` is read once per build. The request's
abort signal and a cancelled response body stop both renders in the worker, and `build.close()`
stops the worker and fails renders still in flight. `build.closed` settles when the worker stops for
any reason, so a server can exit and be restarted instead of failing every later request. The document streams the Flight
bytes its HTML comes from (base64, so binary rows survive) and loads the build's client entry, so client islands hydrate without a
second render and refresh through the existing manifest handshake. Both representations are sent with
`cache-control: private, no-store`. `createRscAssetHandler(build)` serves the hashed client bundle.

The build's entries use two new subpaths: `defineRscServerEntry()` from `@croco/meta-vite/rsc/server`
and `defineRscSsrEntry()` from `@croco/meta-vite/rsc/ssr`. The official plugin functions are passed in.
Server work that shares module state with rendering is declared as `actions` and called with
`build.invokeAction(name, input, { request, context })`.
`@croco/meta-vite/rsc/browser` adds `readRscInitialFlight()`.

`RscRenderOptions` is now a union of `RscEncoderRenderOptions` and `RscBuildRenderOptions`: a `build`
cannot be combined with `encodeFlight`, `clientManifestVersion` or `clientBuildId`. Code that spreads
an `RscRenderOptions` value and then adds `encodeFlight` must type that value as
`RscEncoderRenderOptions`. The isolated encoder is unchanged and stays the default for routes rendered
without a build. It still starts one child process per request and cannot decode client islands.

`createNodeHandler(handler, { origin })` and `createNodeComposedHandler({ origin, ... })` can pin the
public origin a Node server answers for. Node HTTP servers build `request.url` from the client's `Host`
header or an absolute request target, so requests for another host are now refused with
`meta-vite/node-request-origin-mismatch` (400) before routing, and accepted requests are rewritten to
the configured origin. Only the host is compared, so a proxy that ends TLS can forward plain HTTP.
Without `origin`, behavior is unchanged.

New Problem codes with recovery metadata:

- `meta-vite/rsc-build-invalid`: a missing, foreign or mismatched build artifact.
- `meta-vite/rsc-route-not-in-build`: a host `rsc` route that the build does not declare. It is
  `not-retryable`, because no retry can repair a deployment mismatch.
- `meta-vite/node-request-origin-mismatch`.
- `meta-vite/rsc-build-value-unsupported`: a context or action input that is not plain data.
- `meta-vite/rsc-build-worker-failed`: a render or action that threw in the build's worker.
- `meta-vite/rsc-build-worker-unavailable`: a worker that exited or was closed.
- `meta-vite/rsc-build-action-not-found`: an action name the build does not declare.

`create-croco-app` adds `--frontend-deploy node-meta-vite-rsc` for `ddd-fullstack`. It generates
`apps/<web>` as a React Server Components app served by Node through these APIs, with `build`, `start`
and `rsc:smoke` scripts; its `.env.example` lists `HOST` and `PUBLIC_ORIGIN`. `examples/rsc-node-example` now runs on the same adapter instead of its own
server.
