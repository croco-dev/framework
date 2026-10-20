---
"@croco/retry-core": patch
---

Keep Redis HALF_OPEN state, generation and probe counters until an explicit transition so pending probes cannot be bypassed after the configured TTL. Abandoned probes require forceOpen recovery after their upstream work has ended.

Serialize forceOpen recovery with probe bookkeeping so a completion that already passed its generation check cannot overwrite the recovered OPEN state.
