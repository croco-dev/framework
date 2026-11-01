---
"@croco/testing": patch
---

RPC test fetch rejects requests whose effective signal is already aborted before dispatching to the app, preserving the caller's abort reason and RequestInit signal overrides.
