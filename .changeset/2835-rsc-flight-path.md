---
"@croco/meta-vite": minor
"@croco/problems-core": patch
---

Implement real React Flight RSC path (#2835): official `@vitejs/plugin-rsc`
encoder in an isolated `react-server` child process, official
`react-server-dom-webpack/client` decode plus `react-dom/server` HTML render in
`RenderServer`, negotiated HTML vs Flight on one path with manifest-version
diagnostics, explicit server-reference failure, per-call Server Action origin
checks, and the Node production-build proof in `examples/rsc-node-example`.

Problem codes `meta-vite/rsc-client-manifest-mismatch`,
`meta-vite/rsc-client-reference-missing`, `meta-vite/rsc-flight-not-acceptable`,
`meta-vite/rsc-server-reference-unsupported`, `meta-vite/rsc-flight-encode-failed`,
`meta-vite/rsc-flight-encode-timeout`, `meta-vite/rsc-flight-encode-aborted`,
`meta-vite/rsc-encoder-entry-invalid-input`,
`meta-vite/server-action-duplicate-registration` and
`meta-vite/server-action-forbidden-origin` get recovery metadata in the problem
registry, replacing the per-category defaults for these RSC and Server Action
codes.
