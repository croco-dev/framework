---
"@croco/storage-cloudinary": patch
"@croco/problems-core": patch
---

Cancel failed download response bodies before returning the HTTP error or retrying. Bound cleanup waits to one second and stop waiting on caller abort while preserving the original failure and successful response streams.

Generated Problem diagnostics point to the current Cloudinary source locations.
