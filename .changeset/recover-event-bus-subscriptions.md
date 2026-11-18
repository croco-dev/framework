---
"@croco/events-core": patch
---

Allow `EventBusConfig.start()` to restore handlers detached before a bus switch failed. The previous bus stays configured, and readiness reflects the missing subscriptions until they are restored.
