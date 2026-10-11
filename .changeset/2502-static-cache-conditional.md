---
"@croco/transports-http": patch
"@croco/problems-core": patch
---

Node static file serving now emits `ETag`/`Last-Modified` with `Cache-Control`, answers conditional requests with `304`, and streams files above the configured size threshold instead of buffering every response.
