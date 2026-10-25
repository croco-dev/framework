---
"@croco/auth-better-auth": patch
"@croco/auth-clerk": patch
"@croco/batch-qstash": patch
"@croco/metering-core": patch
"@croco/metering-upstash": patch
"@croco/problems-core": patch
"@croco/ratelimit-upstash": patch
"@croco/tasks-qstash": patch
---

Preserve redacted upstream Error diagnostics as non-enumerable Problem causes without retaining provider payloads or changing response classification and non-Error diagnostics. Redis errors retain their original Error cause.
