---
"@croco/preset-node": patch
---

Close idle HTTP keep-alive connections when Node hosts begin shutting down, and force-close remaining HTTP connections when the graceful shutdown deadline expires.
