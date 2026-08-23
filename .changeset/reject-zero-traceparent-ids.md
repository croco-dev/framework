---
"@croco/transports-http": patch
---

Reject W3C `traceparent` headers whose trace ID or parent ID is all zero before installing remote request context.
