---
"@croco/ratelimit-core": patch
"@croco/ratelimit-upstash": patch
"@croco/transports-http": patch
---

HTTP rate-limit outcome skip flags now refund successful limiter checks so skipped success or failure responses do not consume quota, with core and Upstash stores exposing the matching refund contract.
