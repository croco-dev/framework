---
"@croco/meta-vite": minor
"@croco/problems-core": patch
"@croco/frontend-react": patch
---

Implement real React Flight RSC path (#2835): official `@vitejs/plugin-rsc`
encoder in an isolated `react-server` child process, official
`react-server-dom-webpack/client` decode plus `react-dom/server` HTML render in
`RenderServer`, negotiated HTML vs Flight on one path with manifest-version
diagnostics, explicit server-reference failure, per-call Server Action origin
checks, and the Node production-build proof in `examples/rsc-node-example`.

The client manifest version is now per client build: `crocoMetaVitePlugin`
records the client build id in `dist/client/croco-rsc-client-build.json`,
`resolveRscClientManifestVersion` composes it into the negotiated version, and
`createRscBrowserFlightHeaders` lets a browser echo the version its document
was rendered with. A Flight request carrying a different version is refused.

The browser half of that handshake is exported from a new `@croco/meta-vite`
subpath, `./rsc/browser`: the package root is a server entry (it pulls in Node
builtins through the render and build modules), so a client bundle cannot
import it. `createRscBrowserFlightHeaders`, `readRscClientManifestVersion`, and
the manifest constants are reachable from `./rsc/browser`; the implementation
stays owned by the root module, so both paths share one contract.

Problem codes `meta-vite/rsc-client-manifest-mismatch`,
`meta-vite/rsc-client-reference-missing`, `meta-vite/rsc-flight-not-acceptable`,
`meta-vite/rsc-server-reference-unsupported`, `meta-vite/rsc-flight-encode-failed`,
`meta-vite/rsc-flight-encode-timeout`, `meta-vite/rsc-flight-encode-aborted`,
`meta-vite/rsc-encoder-entry-invalid-input`, `meta-vite/rsc-client-build-id-invalid`,
`meta-vite/server-action-duplicate-registration` and
`meta-vite/server-action-forbidden-origin` get recovery metadata in the problem
registry, replacing the per-category defaults for these RSC and Server Action
codes. `meta-vite/rsc-flight-context-unsupported` is new: the isolated encoder
renders in a child process over a JSON pipe, so a route that would need host
context values cannot be served and is refused instead of rendering them as
`undefined`. It carries recovery metadata that states this and marks it
`not-retryable`.

A 5xx Problem answered from the render server now returns its code and a fixed
title instead of its message: the encoder's messages carry route, platform, and
timeout detail that the registry holds `operator-only`, so that detail goes to
the log while the response stays redacted.

`@croco/frontend-react` takes a patch: its development `react` and `react-dom`
versions move to the pinned 19.2.6 so the workspace hoists a single React
resolution against the new peers. `@croco/meta-vite` also records
`"./package.json"` in its workspace exports map, which keeps the isolated
encoder's package-manifest fallback resolvable now that the map exists.

Three corrections to the Flight response path that this review round surfaced:

- The Flight response no longer commits `200` before the encoder proved it can
  render. A server component that fails to import errors on the stream after
  it was handed back, so previously a client received a success status carrying
  a broken body. The first row is read while the status can still change, then
  relayed with the rest; an encoder that closes without writing a row is
  refused too.
- The HTML wrapper is read on consumer demand instead of being drained into the
  internal queue by a `start()` loop, so a slow client no longer holds a whole
  document in memory per in-flight request.
- The meta-tag fallback returns the attribute value the HTML parser already
  decoded, instead of decoding it a second time and mangling a version whose
  own text contains an entity-looking sequence.
