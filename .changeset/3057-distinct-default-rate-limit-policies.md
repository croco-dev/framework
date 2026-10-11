---
"@croco/ratelimit-core": patch
"@croco/problems-core": patch
---

Unrelated controllers with the same default rate-limit policy name now fail during decorator evaluation and must declare explicit policies to avoid sharing a bucket.
