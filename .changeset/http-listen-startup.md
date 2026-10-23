---
"@croco/transports-http": patch
"@croco/problems-core": patch
---

Wait for the Node HTTP listener to start before resolving listen(). Reject startup failures with a transport Problem preserving the Node cause, close the failed listener, and allow retry on another port.
