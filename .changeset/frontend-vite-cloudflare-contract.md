---
"@croco/frontend-vite": patch
---

`crocoVitePlugin({ cloudflare: false })` no longer requires `@cloudflare/vite-plugin` at package import time, and the Cloudflare plugin is documented as an optional peer dependency for the default integration path.
