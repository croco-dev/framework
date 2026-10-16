---
"@croco/testing": patch
---

Restore telemetry capture and async span context after OpenTelemetry global cleanup, while rejecting an external tracer provider on reinstall.
