---
"@croco/membership-core": major
"@croco/membership-drizzle": major
"@croco/invitation-core": patch
"@croco/problems-core": patch
"create-croco-app": patch
---

Make membership mutations idempotent and atomically persist recoverable domain-event intents. Membership command APIs now require caller-supplied idempotency keys, expose replay state through `addMemberCommand()`, and no longer publish inside the command transaction. Durable delivery requires a persistent store, an idempotent event publisher, and a relay or worker that calls `publishPendingEvents()`.
