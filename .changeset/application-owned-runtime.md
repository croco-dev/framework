---
"@croco/framework-context": minor
"@croco/framework-module": minor
"@croco/problems-core": patch
"@croco/testing": minor
"@croco/transports-http": patch
"create-croco-app": patch
---

Let each Croco application own one isolated DI scope and module lifecycle, retry failed startup from
the exact pre-attempt provider baseline, inspect one correlated module and dependency graph, and run
TestKernel without process-global container resets.
Canonical SaaS templates now bind HTTP application calls to their application-owned runtime, and
scoped HTTP bootstrap validation ignores unrelated process-global component registrations.
