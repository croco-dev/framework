---
"@croco/testing": patch
"@croco/cli": patch
---

Changed-test enforcement requires a complete window of full-suite observations with executed tests and no skipped results. Suite markers and verification reports do not count as tests. Existing baselines retain their history and need a fresh observation window to enable enforcement.
