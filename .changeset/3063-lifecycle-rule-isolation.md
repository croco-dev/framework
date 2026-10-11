---
"@croco/lifecycle-core": patch
---

Isolate per-rule evaluation failures so one rule's throwing `when`/`actions` no longer skips later matching rules. The failed rule leaves no run behind for redelivery, and `evaluate()` still rejects with the first rule error after evaluating every matched rule.
