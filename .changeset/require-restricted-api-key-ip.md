---
"@croco/auth-core": patch
---

Reject IP-restricted API keys when verification has no client IP address, including keys with an empty allowlist. Callers verifying restricted keys must pass a trusted client IP to `ApiKeyManager.verify`.
