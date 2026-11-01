---
"@croco/transports-http": patch
---

Preserve ordinary OPTIONS handler responses with CORS enabled. Only OPTIONS requests with an allowed Origin and a nonempty Access-Control-Request-Method are handled as preflight.
