---
"@croco/protocols-core": patch
"@croco/openapi-spec": patch
"@croco/transports-http": patch
---

- Keep declared route success statuses consistent across extraction, OpenAPI responses, and HTTP output.
- Preserve legacy 200 JSON and 204 empty responses when no status is declared, and reject response schemas on body-forbidden statuses.
