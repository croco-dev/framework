---
"@croco/meta-vite": minor
---

Shell-first streaming SSR: SSR pages with declared deferred regions stream the critical shell first and resolve regions later through React Suspense. Shell status decisions (`resolveShell`) commit before header flush; after-flush region errors keep a safe fallback without status rewrites or stack exposure. Request cancellation propagates through the per-request region signal, and Lambda buffers shell-first pages before returning. SSR pages with regions now report `streaming-response` in the route manifest.
