---
"@croco/framework-context": patch
"@croco/problems-core": patch
---

Reject request provider resolution and instance tracking after request scope disposal with `framework-context/request-scope-disposed`, preventing untracked replacement instances in background continuations.
