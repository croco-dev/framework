---
"@croco/telemetry-api": patch
"@croco/telemetry-sdk-node": patch
---

OpenTelemetry runtime dependencies now use the patched Jaeger propagation train so malformed propagation headers cannot trigger the known denial-of-service path.
