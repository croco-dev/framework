---
"@croco/rpc-codegen": patch
---

Generated RPC clients now reject non-2xx HTTP responses before parsing successful output data and preserve RFC 7807 Problem Details in typed client errors.
