---
"@croco/invitation-core": patch
"@croco/problems-core": patch
---

Reject invalid invitation expiry durations before token generation, persistence, notification, or event side effects.
Email and link invitations now require a positive integer day count that produces a finite expiration date.
