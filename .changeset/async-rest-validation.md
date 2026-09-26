---
"@croco/protocols-rest": patch
"@croco/transports-http": patch
---

REST parameter and route response schemas now support asynchronous Zod refinements. `ValidationPipe.transform` returns a Promise, while `validateResponse` retains its synchronous API.
