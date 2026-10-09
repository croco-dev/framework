---
"@croco/transports-http": patch
---

Synchronize middleware-returned Response statuses with the HTTP context so telemetry and rate-limit skip options use the actual response status.
