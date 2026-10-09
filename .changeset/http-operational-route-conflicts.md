---
"@croco/transports-http": patch
"@croco/problems-core": patch
---

Reject controller GET and ALL routes that collide with enabled built-in operational endpoints at bootstrap, identifying the reserved path and controller method.
