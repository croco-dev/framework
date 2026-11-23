# Serve each Vite RSC production build from a worker thread of its own

Ticket: #4064

## Context

- `examples/rsc-node-example` served its production build through a hand-written `serve.mjs` that did not
  import `@croco/meta-vite`. `RenderServer.handleRsc` could not render client islands: it decoded Flight
  with an empty client manifest and rejected client references with 400, and its document carried no
  client entry (`packages/meta-vite/src/libs/rsc/ssrDecode.ts`, `renderServer.ts` at `288b093`).
- `@vitejs/plugin-rsc` 0.5.38 bundles each environment with its own React conditions at build time, so the
  built `rsc` and `ssr` entries import only Node builtins and can be loaded by a plain Node process.
- The same plugin registers its module loaders on `globalThis` when a built entry loads
  (`dist/core/ssr.js` sets `__vite_rsc_client_require__`, `dist/core/rsc.js` sets
  `__vite_rsc_server_require__`). Loading two different builds into one thread made one app render the
  other's client components; a two-build host test failed with `useState` of `null`.
- The client entry URL is available only through `getClientEntryUrl()` in the built `ssr` environment,
  which reads a virtual module the host process cannot import.

## Decision

- `loadRscBuild({ outDir })` validates a plugin-rsc build and loads its `rsc` and `ssr` entries into a
  `node:worker_threads` worker owned by that build. `RenderServer` receives it as `{ build }` and keeps its
  existing negotiation, manifest check, Vary, first-row preflight and Problem mapping.
- The host and the worker exchange Flight and HTML chunks one pull at a time. A Flight request keeps the
  consumer's backpressure across the boundary; a document request buffers the whole Flight payload in the
  worker, because that payload is embedded after the HTML. (Superseded for documents by
  [2026-11-23-4065-stream-document-flight](2026-11-23-4065-stream-document-flight.md).) Request abort and body cancel stop the render
  inside the worker and settle the host side.
- A build exposes `closed`, which settles when its worker stops. The generated app and the example exit on
  it so a supervisor restarts the server, instead of serving 500 for every request from a dead worker.
- The document embeds the Flight bytes it was rendered from as base64 and loads the build's client entry;
  the browser reads them with `readRscInitialFlight()` and hydrates without a second render. Base64 keeps
  binary Flight rows (typed arrays, `ArrayBuffer`) intact, which a UTF-8 text payload would corrupt.
- Responses from a build carry `cache-control: private, no-store`, because every render reads that
  request's cookies and context.
- `createNodeHandler` and `createNodeComposedHandler` accept the public `origin`. A request for another
  host is refused with 400 and an accepted request is rewritten to that origin. Only the host is compared,
  because `@hono/node-server` derives the scheme from the socket and a TLS-terminating proxy forwards
  plain HTTP.
- `createRscAssetHandler` serves the hashed client bundle so apps do not each copy static serving.
- `RscRenderOptions` becomes a union so a `build` cannot be combined with the encoder options; code that
  spreads the options and then adds `encodeFlight` must use `RscEncoderRenderOptions`.
- Runtime context and action input cross the boundary as plain data only. Functions, class instances,
  accessors and cycles are refused instead of being structured-cloned into a different value.
- Server work that must share module state with rendering is declared as `actions` on the built `rsc` entry
  and called with `build.invokeAction()`.
- The app's entries use `defineRscServerEntry()` and `defineRscSsrEntry()`, with the official plugin
  functions passed in.

Alternatives not chosen:

- Render in the host thread. It passes live host values through unchanged, but builds of different apps
  in one process resolve each other's modules through the plugin's globals.
- One build per process, refusing a second build. It is small, but one Node process can no longer serve
  more than one RSC app.
- Trusting `X-Forwarded-Proto`/`Host` for the origin. It gives the exact scheme behind a known proxy, but a
  misconfigured server would let client-sent forwarded headers become the authority again.
- Restarting a dead worker automatically. It keeps the server answering, but silently resets module state
  (caches, experiment bridges) and hides crash loops.
- A standalone handler copied from `serve.mjs`. It duplicates `handleRsc` negotiation and error mapping,
  so HTML and Flight rules would drift between the two.
- The plugin's own fetch handler inside the `rsc` bundle. It gives dev and preview parity, but its
  `fetch(request)` signature cannot carry host context, and Croco's route, head and Problem paths would have
  to be rebuilt under the `react-server` condition.

## Consequences

- Several apps' builds can share one Node process; each build has separate module state.
- Server components receive the request URL, method and headers but not the body, and `head()` is read once
  per build.
- A crashed or closed worker fails its in-flight and later renders with
  `meta-vite/rsc-build-worker-unavailable`; servers exit on `closed` and are restarted by their supervisor.
- Health probes must send the public host once `origin` is set.
- The build path has no render deadline of its own; slow data sources must be bounded in server components.
- Lambda and Cloudflare Workers support for this path stays unverified; Workers isolates cannot run it
  because it needs `node:fs` and `node:worker_threads`.
- Routes rendered without a build keep the isolated encoder, which starts one child process per request.
- Early hydration (#4065) replaced the embedded payload with Flight blocks streamed into the HTML; see
  [2026-11-23-4065-stream-document-flight](2026-11-23-4065-stream-document-flight.md).
