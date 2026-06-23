---
"@croco/preset-lambda": patch
"@croco/preset-node": patch
"@croco/transports-http": patch
---

HTTP runtime packages now require a patched Hono range so production dependency audits do not include known high-severity Hono advisories.
