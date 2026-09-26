---
"@croco/transports-http": patch
"@croco/problems-core": patch
---

For allowed origins, apps with CORS middleware now answer preflight requests for registered routes without an explicit `@Options` handler. The default CORS configuration also allows requested headers such as `content-type` and varies the preflight response by `Access-Control-Request-Headers`.
