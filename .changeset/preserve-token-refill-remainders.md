---
"@croco/ratelimit-core": patch
"@croco/ratelimit-upstash": patch
---

Preserve fractional token-bucket refill time below capacity while discarding burst credit accumulated at full capacity across in-memory and Upstash stores.
