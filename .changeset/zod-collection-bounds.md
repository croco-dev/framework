---
"@croco/auth-better-auth": patch
"@croco/billing-polar": patch
"@croco/framework-config": patch
"@croco/pagination-core": patch
---

Require Zod 4.6.6 so oversized constrained collections fail before their elements are validated (GHSA-mrhx-c7xc-m3w5). Existing Zod 3 route contracts require a separate major-version migration and are not remediated by this patch.
