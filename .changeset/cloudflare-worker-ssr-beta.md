---
"@croco/frontend-cloudflare": minor
"create-croco-app": patch
---

`@croco/frontend-cloudflare` now has beta Worker SSR evidence for service-binding API routing, assets fallback, streaming `Response` preservation, Cloudflare RuntimeContext propagation, and deterministic failure behavior. The generated Cloudflare meta-vite fullstack profile now exports a real Worker SSR handler and smoke-tests the Worker boundary.
