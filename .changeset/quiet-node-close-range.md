---
"@croco/preset-node": patch
---

Reject close timeouts outside the Node timer range before changing the host lifecycle, preserving the listener and active responses after invalid calls.
