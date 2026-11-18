---
"@croco/meta-vite": patch
---

Report measured shell readiness in `Server-Timing` for shell-first SSR and omit the duration when the host clock cannot measure it. Existing timing entries are preserved. Deferred region settlement time is available to `stream.onSettle`, and a failure in that callback leaves the response intact.
