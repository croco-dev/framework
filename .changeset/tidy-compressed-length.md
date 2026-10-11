---
"@croco/transports-http": patch
---

Remove stale Content-Length headers from all response header sources after compression, regardless of header name casing.
