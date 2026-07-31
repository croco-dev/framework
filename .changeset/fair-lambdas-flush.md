---
"@croco/cli": patch
"@croco/preset-lambda": patch
---

Lambda preset handlers can now flush telemetry before returning, and `croco doctor` detects preset handlers that omit the flush boundary.
