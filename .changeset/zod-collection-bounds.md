---
"@croco/auth-better-auth": patch
"@croco/billing-polar": patch
"@croco/framework-config": patch
"@croco/framework-context": patch
"@croco/problems-core": patch
"@croco/pagination-core": patch
---

Use Zod 4.6.6 throughout runtime schemas and generated applications so oversized constrained collections fail before their entries are validated (GHSA-mrhx-c7xc-m3w5).
