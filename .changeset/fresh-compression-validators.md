---
"@croco/transports-http": patch
---

Compressed responses discard digests and strong ETags for the original bytes across response and context headers. Weak ETags and uncompressed response validators are preserved.
