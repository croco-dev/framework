---
"@croco/metering-core": patch
---

Keep usage, quota, reset, and idempotency state isolated when tenant, meter, or request identifiers contain delimiters, Unicode, glob characters, or empty values by using a versioned encoded Redis key format.
