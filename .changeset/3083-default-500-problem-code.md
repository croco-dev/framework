---
"@croco/problems-core": patch
"@croco/protocols-rest": patch
"@croco/transports-http": patch
---

fix(transports-http): include Problem code in default 500 responses

Default 500 bodies for non-Problem failures now carry the shared
`FALLBACK_INTERNAL_SERVER_ERROR_PROBLEM_CODE`, matching the
`HttpExceptionFilter` fallback and the OpenAPI `ProblemDetails` contract.
