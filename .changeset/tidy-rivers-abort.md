---
"@croco/transports-http": patch
---

Reject aborted request bodies before handler dispatch and release pending readers without waiting for source cancellation to finish.
