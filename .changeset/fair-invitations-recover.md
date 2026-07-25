---
"@croco/invitation-core": minor
"@croco/invitation-drizzle": minor
"@croco/notifications-core": patch
"@croco/problems-core": patch
---

Require email invitation creation idempotency keys and keep invitations non-accepting until claimed event and notification phases complete, so acknowledgement loss, retries, and concurrent requests reuse one invitation and token without exposing contradictory pending state. Replay tokens are application-encrypted in Drizzle, and notification delivery can now require provider-level idempotency support. Custom invitation stores must implement the new atomic creation, claim, activation, and cleanup methods; Drizzle consumers must apply the included creation-intent migration and configure a token cipher before deploying.
