---
"@croco/framework-routes": patch
"@croco/transports-http": patch
---

Generated route modules now resolve declared controllers through Croco DI and invoke their bound handler methods instead of returning placeholder responses.
