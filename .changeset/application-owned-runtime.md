---
"@croco/framework-context": minor
"@croco/framework-module": minor
"@croco/problems-core": patch
"@croco/testing": minor
---

Let each Croco application own one isolated DI scope and module lifecycle, retry failed startup from
the exact pre-attempt provider baseline, inspect one correlated module and dependency graph, and run
TestKernel without process-global container resets.
