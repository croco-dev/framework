---
"@croco/execution-core": patch
"@croco/admin-ops": patch
---

Unresolved execution outcomes require inspection and attempt-fenced operator recovery before retry or replay, including failed ETL receipts. Automatic failure retries preserve uncertainty, and the retry console offers inspection for these outcomes. Operator recovery retains attempt-bound reasons and timestamps across repeated unresolved outcomes.
