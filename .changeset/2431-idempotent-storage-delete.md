---
"@croco/storage-core": patch
"@croco/storage-cloudflare": patch
"@croco/testing": patch
---

Resolve missing-key and repeated deletes in InMemoryStorageProvider and Cloudflare Images, matching R2 and Cloudinary. Storage provider conformance now checks both deletion paths, with the Cloudflare mock returning 404 for missing images.
