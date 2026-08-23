---
"@croco/notifications-core": minor
"@croco/notifications-resend": patch
"@croco/problems-core": patch
"@croco/testing": minor
---

Require every notification provider to declare its template, idempotency, channel, and outbox capabilities,
reject contradictory profiles at registration with stable Problems, and preserve the validated profile for
dispatch and diagnostics. External `NotificationProvider` implementations must add `getCapabilities()` and
choose every capability value explicitly; no inferred compatibility profile remains.

Resend and application test providers can verify the same capability contract through the shared notification
provider conformance suite. The Problems registry now publishes the stable missing-profile, provider-name
mismatch, and provider-channel mismatch notification codes.
