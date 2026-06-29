---
"@croco/notifications-core": minor
"@croco/notifications-resend": patch
"@croco/invitation-core": patch
---

`@croco/notifications-core` now exposes deterministic preference evaluation, schema-validated template rendering with preview fixtures, required service-level preference/idempotency contracts, explicit dispatch/outbox metadata, and telemetry-backed delivery failure Problems.

`@croco/notifications-resend` now declares its rendered-email dispatch capabilities.

`@croco/invitation-core` now sends invitation notifications with explicit preference context and idempotency keys.
