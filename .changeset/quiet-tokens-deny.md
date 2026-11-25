---
"@croco/problems-core": patch
"@croco/protocols-core": patch
"@croco/protocols-graphql": patch
"@croco/protocols-rest": patch
---

REST and GraphQL auth guards report JWT credential rejections from jose and jsonwebtoken as invalid tokens. Verifier and signing-key lookup failures keep their server error response.

Distinguishing a JOSE crypto failure from a signature mismatch requires a verifier that retains the underlying cause, as jose 6.2.13 does.
