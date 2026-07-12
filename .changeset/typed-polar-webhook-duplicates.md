---
"@croco/billing-core": patch
"@croco/billing-polar": patch
---

Polar webhook retries now acknowledge duplicates only through the typed billing-store contract, while unrelated reservation failures remain retriable without exposing storage details.
