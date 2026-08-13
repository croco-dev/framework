---
"@croco/invitation-core": major
"@croco/invitation-drizzle": patch
"@croco/problems-core": patch
"create-croco-app": patch
---

Require link invitation and resend commands to carry an idempotency key so retries preserve one token and event identity after delivery failures. Drizzle deployments must apply the exported creation-intent migration and configure a 32-byte invitation token-cipher key before upgrading.
