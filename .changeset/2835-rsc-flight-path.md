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
codes.

`@croco/frontend-react` takes a patch: its development `react` and `react-dom`
versions move to the pinned 19.2.6 so the workspace hoists a single React
resolution against the new peers. `@croco/meta-vite` also records
`"./package.json"` in its workspace exports map, which keeps the isolated
encoder's package-manifest fallback resolvable now that the map exists.
