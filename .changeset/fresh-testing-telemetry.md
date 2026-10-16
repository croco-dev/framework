---
"@croco/testing": patch
"@croco/problems-core": patch
---

Restore telemetry capture and async span context after OpenTelemetry global cleanup, while rejecting an external tracer provider on reinstall. Keep the generated Problem source location aligned with the telemetry helper.
