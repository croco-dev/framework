---
"@croco/meta-vite": patch
---

Require `react-dom` as a peer for the packed root entrypoint because it imports `react-dom/server` at runtime.
