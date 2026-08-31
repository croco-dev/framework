---
"@croco/storage-cloudinary": patch
"@croco/problems-core": patch
---

Reject unsafe Cloudinary upload base URLs during provider construction so direct-upload intents cannot expose embedded URL credentials.

Refresh generated Problem source locations for the corrected provider implementation.
