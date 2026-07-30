---
"@croco/metering-core": minor
---

Fence metering idempotency leases with a unique ownership claim so an expired worker cannot complete or abort a newer
worker's acquisition. Direct `IdempotencyManager` lifecycle callers must retain the claim returned by
`beginProcessing()` or `beginProcessingOrThrow()` and pass it to completion or abort.
