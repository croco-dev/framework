---
"@croco/transports-http": patch
---

Release response stream reader locks after request-abort cancellation settles, including failed cancellation and races with consumer cancellation or stream completion.
