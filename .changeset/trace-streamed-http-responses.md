---
"@croco/transports-http": patch
"@croco/problems-core": patch
---

Keep streaming HTTP response work in the original request trace until the body completes, fails, or is cancelled. A body failure marks the span as failed and records the cause while preserving the HTTP status sent to the client.
