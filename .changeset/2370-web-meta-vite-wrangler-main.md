---
"create-croco-app": patch
---

Fix the non-fullstack `cloudflare-meta-vite` web template to emit an assets-only `wrangler.toml` instead of referencing the unbuilt `dist/worker-ssr/index.js` entry.
