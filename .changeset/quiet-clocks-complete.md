---
"@croco/testing": patch
"@croco/problems-core": patch
---

Allow TestClock to drain async scheduled callbacks that await sleeps on the same clock, preserving virtual-time ordering, callback failures, and the callback budget.

Keep generated Problem registry source locations aligned with the runtime declarations.
