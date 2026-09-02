---
"@croco/preset-cloudflare": patch
---

Pass each Worker request's abort signal through the default runtime context and preserve the app receiver during fetch, so
Croco applications can validate runtime capabilities and observe request cancellation.
