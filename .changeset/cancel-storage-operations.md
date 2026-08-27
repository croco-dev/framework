---
"@croco/storage-core": minor
"@croco/storage-r2": patch
"@croco/storage-cloudinary": minor
"@croco/storage-cloudflare": patch
"@croco/testing": patch
"@croco/problems-core": patch
---

Propagate caller cancellation through every asynchronous storage operation, reject pre-aborted calls before provider I/O, and preserve the original abort reason in a stable storage Problem.

Storage provider conformance now verifies the shared pre-abort contract across adapters.

Cloudinary server API calls can use a separate validated `apiBaseUrl`, while `uploadBaseUrl` remains scoped to upload intents so server credentials are never redirected to an existing upload proxy.
