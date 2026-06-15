---
"@croco/storage-cloudinary": patch
"@croco/storage-core": patch
"@croco/storage-r2": patch
---

Storage package root entrypoints now point directly at shipped `dist` files and are guarded by package manifest validation.
