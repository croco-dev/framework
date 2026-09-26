---
"@croco/telemetry-api": patch
---

Preserve stream and async generator APIs in @Trace return values. Thenable async iterables follow the Promise path, while plain async iterables keep iteration-scoped spans.
