---
"@croco/protocols-core": patch
"@croco/openapi-spec": patch
---

Refined object route contracts now resolve per-field query and path bindings for diagnostics and OpenAPI parameters. Partially bound wrapped contracts fail with the same missing-param binding diagnostic as plain object contracts, and fully bound fields emit plain-contract types and requiredness while runtime validation keeps the full refined schema.
