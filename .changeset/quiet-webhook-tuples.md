---
"@croco/webhooks-core": patch
---

Keep outbound webhook deliveries and dispatch identities distinct when event or endpoint IDs contain colons. In-memory delivery IDs now use an opaque JSON tuple instead of the previous colon-joined format; callers must retain returned IDs rather than reconstructing them.
