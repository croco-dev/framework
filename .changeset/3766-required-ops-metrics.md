---
"@croco/cli": patch
---

Check `/metrics` whenever `requiredEndpoints` includes `metrics`, even when `includeMetrics` is false. A failed required metrics check reports an unhealthy application.
