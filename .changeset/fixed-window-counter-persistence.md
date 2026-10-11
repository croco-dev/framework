---
"@croco/ratelimit-core": patch
---

Persist fixed-window increments for keys without a policy window, honor their explicit TTLs, and clear standalone counters on reset while retaining existing window accumulation.
