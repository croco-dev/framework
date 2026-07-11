---
"@croco/events-tx": patch
---

Prevent stale transactional inbox workers from overwriting newer retries or terminal records by requiring the accepted attempt claim on completion.
