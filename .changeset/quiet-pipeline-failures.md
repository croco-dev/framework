---
"@croco/etl-core": patch
---

Preserve original pipeline failures when failure recording or reader cleanup also fails. Return confirmed publication results after cleanup failures and emit redacted, structured secondary-failure diagnostics.
