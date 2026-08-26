---
"@croco/framework-module": patch
"@croco/problems-core": patch
---

Reject module registration while the registry is initializing, initialized, or shutting down with an actionable lifecycle conflict Problem, while preserving reset-based graph replacement.
