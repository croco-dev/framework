---
"@croco/access-core": patch
"@croco/audit-core": patch
"@croco/auth-core": patch
"@croco/framework-config": patch
"@croco/llm-core": patch
"@croco/llm-metering": patch
"@croco/ratelimit-core": patch
"@croco/retry-core": patch
"@croco/transports-graphql": patch
---

Decorator packages now declare `reflect-metadata` as a runtime dependency whenever their published source imports it, so strict consumers can import those decorators without relying on undeclared transitive installs.
