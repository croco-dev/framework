---
"@croco/events-core": patch
"@croco/metering-core": minor
"@croco/metering-upstash": patch
"@croco/problems-core": patch
"create-croco-app": patch
---

Metering retries now resume an explicit pending-event stage, preserve logical event identities, and recover publication
failures without recording usage twice.

Custom `UsageStorage` implementations must declare `replayContract: "idempotent"` and replay the original quota result
for a repeated idempotency key. Redis clients must explicitly declare multi-key script support.
