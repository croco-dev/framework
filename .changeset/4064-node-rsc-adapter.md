---
"@croco/meta-vite": minor
"create-croco-app": minor
"@croco/problems-core": patch
---

Serve `@vitejs/plugin-rsc` production builds on Node through the public meta-vite adapter (#4064).

`loadRscBuild({ outDir })` loads a production build into the server process and validates it at
startup. Pass the result to `new RenderServer(build.routes, { build })`. RSC routes then render
through the built `rsc` and `ssr` entries without a child process, live `RuntimeContext` values reach
server components, and the request's abort signal stops both renders. The document embeds the Flight
bytes its HTML came from and loads the build's client entry, so client islands hydrate without a
second render and refresh through the existing manifest handshake. Both representations are sent with
`cache-control: private, no-store`. `createRscAssetHandler(build)` serves the hashed client bundle.

The build's entries use two new subpaths: `defineRscServerEntry()` from `@croco/meta-vite/rsc/server`
and `defineRscSsrEntry()` from `@croco/meta-vite/rsc/ssr`. The official plugin functions are passed in.
`@croco/meta-vite/rsc/browser` adds `readRscInitialFlight()`.

`RscRenderOptions` is now a union of `RscEncoderRenderOptions` and `RscBuildRenderOptions`: a `build`
cannot be combined with `encodeFlight`, `clientManifestVersion` or `clientBuildId`. Code that spreads
an `RscRenderOptions` value and then adds `encodeFlight` must type that value as
`RscEncoderRenderOptions`. The isolated encoder is unchanged and stays the default for routes rendered
without a build. It still starts one child process per request and cannot decode client islands.

`createNodeHandler(handler, { origin })` and `createNodeComposedHandler({ origin, ... })` can pin the
origin a Node server answers for. Node HTTP servers build `request.url` from the client's `Host` header
or an absolute request target, so other origins are now refused with
`meta-vite/node-request-origin-mismatch` (400) before routing. Without `origin`, behavior is unchanged.

New Problem codes with recovery metadata:

- `meta-vite/rsc-build-invalid`: a missing, foreign or mismatched build artifact.
- `meta-vite/rsc-route-not-in-build`: a host `rsc` route that the build does not declare. It is
  `not-retryable`, because no retry can repair a deployment mismatch.
- `meta-vite/node-request-origin-mismatch`.

`create-croco-app` adds `--frontend-deploy node-meta-vite-rsc` for `ddd-fullstack`. It generates
`apps/<web>` as a React Server Components app served by Node through these APIs, with `build`, `start`
and `rsc:smoke` scripts. `examples/rsc-node-example` now runs on the same adapter instead of its own
server.
