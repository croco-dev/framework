---
"@croco/metering-core": patch
---

Reject missing or empty instance tenant IDs before metered calls execute when MeteringService is configured. Remove the implicit shared "default" tenant fallback; callers must supply their tenant ID explicitly.
