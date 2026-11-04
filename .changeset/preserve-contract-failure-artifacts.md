---
"@croco/testing": patch
"@croco/problems-core": patch
---

Contract fuzz failures for distinct routes retain separate replay artifacts even when their readable filenames would otherwise collide.

Generated Problem diagnostics point to the current contract-testing source locations.
