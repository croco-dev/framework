---
"@croco/telemetry-sdk-node": patch
"create-croco-app": patch
---

Send traces to `/v1/traces` when `OTEL_EXPORTER_OTLP_ENDPOINT` supplies a base URL, including in generated apps and Lambda presets.
