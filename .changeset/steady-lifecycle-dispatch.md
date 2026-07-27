---
"@croco/lifecycle-core": minor
---

Lifecycle action dispatch now atomically claims idempotency and cooldown windows, holds an
expiring active-version lease while adapter calls begin, aborts unfinished claims after
infrastructure failure, and snapshots static rules so concurrent evaluation, pause commands, and
caller mutation cannot change reviewed behavior.
