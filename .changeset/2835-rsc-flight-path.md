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
