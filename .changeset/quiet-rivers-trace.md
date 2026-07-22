---
"@croco/telemetry-sdk-node": patch
---

Apply `TelemetryConfig.environment` to the stable OpenTelemetry `deployment.environment.name`
resource attribute and expose the effective value through safe diagnostics. When the top-level option
is omitted, a string value already provided for the stable resource attribute is preserved before
falling back to `development`; the top-level option wins conflicts.

Lambda presets no longer emit the deprecated `deployment.environment` resource attribute. Consumers
that only set that raw deprecated key should move its value to `environment` or
`resourceAttributes['deployment.environment.name']`.
