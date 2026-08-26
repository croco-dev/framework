---
"@croco/transports-http": patch
---

Keep successful Lambda responses successful when `waitUntil` rejection reporting sinks fail, while preserving separate fallback evidence for the task rejection and logger failure.
