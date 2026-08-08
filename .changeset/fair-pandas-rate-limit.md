---
"@croco/ratelimit-core": patch
"@croco/transports-http": patch
---

Make the HTTP middleware `failOpen` policy govern rate-limit store outages and emit runtime inspection evidence for the resulting allow or reject decision.
