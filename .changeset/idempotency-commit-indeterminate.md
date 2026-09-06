---
"@croco/idempotency-core": patch
---

Record commit-stage failures as non-retryable so repeated keys never re-run completed handler side effects, and expose
`idempotency-core/execution-indeterminate` for the resulting recovery state.
