---
"@croco/testing": patch
---

Ended telemetry capture spans ignore later recording mutations and retain the first end time, matching the OpenTelemetry recording lifecycle while preserving parent context.
