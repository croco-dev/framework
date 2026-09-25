---
"@croco/health-core": minor
"@croco/transports-http": patch
---

Health and readiness checks now cancel active indicators when their caller aborts, including HTTP health requests whose clients disconnect.
