---
"@croco/membership-core": patch
"@croco/membership-drizzle": patch
---

Scope membership command replay, pending-intent lookup and new event identities by tenant so separate tenants can reuse the same idempotency key. Custom stores and lookup callers must supply tenantId. PostgreSQL deployments must stop writers and relays and apply scopeMembershipCommandsByTenant before deploying; the migration preserves existing results and publication identities. Old and new application versions must not run together, and application-only rollback is unsupported after cross-tenant key reuse.
