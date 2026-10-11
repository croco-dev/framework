---
"@croco/storage-core": patch
"@croco/storage-r2": patch
"@croco/storage-cloudinary": patch
"@croco/storage-cloudflare": patch
"@croco/testing": patch
---

Reject storage keys containing `.` or `..` path segments before provider operations, including public URL generation and remote downloads.
