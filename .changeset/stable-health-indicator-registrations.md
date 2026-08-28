---
"@croco/health-core": minor
"@croco/problems-core": patch
---

Register health and readiness indicators with stable explicit IDs, reject duplicate IDs within each namespace, and return disposable lifecycle handles.

The legacy indicator-only registration overloads remain available but are deprecated because they cannot provide stable component IDs.
