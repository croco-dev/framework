---
"@croco/metering-core": patch
---

Redis billable usage claims require activation after local persistence and quota approval, even when the delivery index contains stale inactive intents. Stale index entries no longer block activated usage, while durable intents, replay, retry scheduling and lease fencing are preserved.
