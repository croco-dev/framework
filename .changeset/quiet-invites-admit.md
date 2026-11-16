---
"@croco/invitation-core": patch
"@croco/invitation-drizzle": patch
"@croco/problems-core": patch
---

Enforce rolling tenant invitation quotas atomically for email, link and batch creation. A replay of a live creation can resume at the limit without consuming another slot. Custom invitation stores can support the rate-limited service by implementing the atomic creation method.
