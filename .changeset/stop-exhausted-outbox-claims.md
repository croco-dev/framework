---
"@croco/events-tx": patch
---

Prevent outbox messages that exhausted their publish attempts from being claimed again after their visibility lease expires.
