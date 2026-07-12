---
"@croco/transports-http": patch
"@croco/problems-core": patch
"@croco/protocols-core": patch
"@croco/protocols-rest": patch
"@croco/transports-graphql": patch
---

Enforce HTTP body limits against actual streamed bytes while preserving accepted bodies for downstream parsers across Node and Lambda adapters. Publish canonical 413 Payload Too Large contracts for `transports-http/request-body-too-large` and the existing `transports-graphql/request-body-too-large` Problem across registries and transports, while marking the HTTP status as runtime-configurable when `bodyLimitMiddleware.statusCode` overrides its 413 default.
