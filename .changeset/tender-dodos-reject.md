---
"@croco/problems-core": patch
"@croco/protocols-core": patch
"@croco/protocols-rest": patch
"@croco/protocols-trpc": patch
"@croco/transports-http": patch
---

Reject request bodies with unsupported media types as RFC 7807 415 Problems before reading their bytes.
