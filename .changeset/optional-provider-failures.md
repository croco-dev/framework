---
"@croco/framework-context": patch
"@croco/problems-core": patch
---

Optional DI resolution now propagates failures from registered providers instead of treating them as absent.
The Problem registry points to the updated DI source locations.
