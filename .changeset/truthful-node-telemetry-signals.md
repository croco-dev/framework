---
"@croco/telemetry-sdk-node": minor
"@croco/problems-core": patch
"create-croco-app": patch
---

Expose a trace-only telemetry contract by removing the unimplemented metrics and logs facades and their reserved configuration. Consumers should remove metrics and logs options and stop branching on the deprecated `TELEMETRY_SIGNAL_UNSUPPORTED` Problem code. Generated applications now emit trace-only configuration, and packed consumer coverage verifies the published trace types and the complete initialization, flush, and shutdown lifecycle.
