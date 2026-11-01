---
"@croco/retry-core": patch
---

Serialize forced circuit closure with other state transitions so concurrent failure bookkeeping cannot leave a closed circuit permanently rejecting calls.
