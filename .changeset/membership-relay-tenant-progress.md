---
"@croco/membership-core": minor
"@croco/membership-drizzle": minor
---

Keep independent tenants publishing when membership event delivery fails. Relay batches preserve tenant order, retain all failures and successful counts, and rotate durable attempt evidence across bounded retries. Custom stores must implement attempt recording and tenant-head selection. Existing PostgreSQL installations must apply addMembershipEventRelayAttempts before deploying the new relay.
