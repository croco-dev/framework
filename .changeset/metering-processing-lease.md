---
"@croco/metering-core": minor
---

Acquire a short IN_PROGRESS lease before metering work and retain COMPLETED only after explicit completion. Abandoned simple processing leases can be retried after 30 seconds by default; completed keys retain their configured TTL (24 hours by default).

Breaking migration: checkAndMark now returns IdempotencyClaim | null instead of boolean, and checkAndMarkOrThrow returns IdempotencyClaim instead of void. Retain the claim and call completeProcessing after committing work, or abortProcessing after a confirmed failure. Business writes must remain idempotent across lease expiry and crashes after commit.
