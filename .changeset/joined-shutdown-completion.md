---
"@croco/framework-context": patch
---

Make every concurrent `ShutdownManager.shutdown()` caller wait for and observe the same hook completion, failure, or timeout result.
