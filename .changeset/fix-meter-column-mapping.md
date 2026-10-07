---
"@croco/metering-drizzle": patch
"@croco/problems-core": patch
---

Persist and restore meter definitions through the configured meterSchema column mappings, including custom table property names. Reject mappings that reference columns outside meterTable or reuse another meter field’s target before writing.
