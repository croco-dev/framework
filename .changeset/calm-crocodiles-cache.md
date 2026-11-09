---
"@croco/meta-vite": patch
---

Preserve binary and compressed ISR response bytes and null bodies in the Redis cache. Use an isolated versioned namespace so older deployments cannot misread the new encoding; existing text entries are ignored and retain their original TTL.
