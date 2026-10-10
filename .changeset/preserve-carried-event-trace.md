---
"@croco/events-inmemory": patch
---

Preserve valid trace context carried by events as the remote parent of handler spans, including outbox relay publishes, while retaining active trace context for publish spans.
