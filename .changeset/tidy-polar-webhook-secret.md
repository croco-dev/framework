---
"@croco/billing-polar": patch
---

Accept Standard Webhooks signatures for whsec\_-prefixed secrets while preserving legacy Polar HMAC signatures, including legacy prefixed secrets. Reject tampered payloads and unrelated signing keys before billing side effects.
