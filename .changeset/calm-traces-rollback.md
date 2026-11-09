---
"@croco/telemetry-sdk-node": patch
---

Release resources from failed telemetry startup attempts before allowing reinitialization. Preserve startup and rollback errors and reject retries when cleanup fails or times out.
