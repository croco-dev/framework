---
"@croco/meta-vite": patch
---

Expose the Redis ISR adapter through the published `@croco/meta-vite/isr/adapters` entrypoint and declare its optional `ioredis` peer contract while keeping root server-action types usable without Redis.
