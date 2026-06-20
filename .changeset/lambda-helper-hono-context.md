---
"@croco/transports-http": patch
---

Fix Lambda event/context helpers to read the Lambda execution env from the Hono context passed through Croco raw route parameters.
