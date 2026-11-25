---
"@croco/execution-core": patch
---

Manual retries reject executions outside the failed or timed-out states with
`execution/invalid-state-transition`. A duplicate retry can no longer start another task
handler while the current attempt is running.
