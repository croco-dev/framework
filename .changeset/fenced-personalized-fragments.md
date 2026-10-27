---
"@croco/cache-core": patch
"@croco/meta-vite": patch
---

Keep invalidated personalized fragment reloads from restoring old shared values. In-memory refreshes retain stale reads, coalesce same-key loaders and respect invalidation; adapters without coordinated refresh keep reload results request-local. Live foreground waiters can retry locally when a coalesced owner fails or cancels.
