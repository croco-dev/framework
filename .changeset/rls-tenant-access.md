---
"@croco/tx-drizzle": patch
"@croco/customer-health-drizzle": patch
---

Non-owner PostgreSQL roles can access matching tenant rows through paired permissive and restrictive RLS policies while unrelated permissive policies remain constrained by tenant isolation. The implicit `app_admin` exception is removed; pass `adminRoles: ["app_admin"]` to retain it.
