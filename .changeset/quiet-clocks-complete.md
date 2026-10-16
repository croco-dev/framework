---
'@croco/testing': patch
---

Allow TestClock to drain async scheduled callbacks that await sleeps on the same clock, preserving virtual-time ordering, callback failures, and the callback budget.
