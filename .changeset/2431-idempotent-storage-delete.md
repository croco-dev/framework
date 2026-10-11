---
"@croco/storage-core": patch
"@croco/storage-cloudflare": patch
"@croco/problems-core": patch
"@croco/testing": patch
---

Resolve missing-key and repeated deletes in InMemoryStorageProvider and Cloudflare Images, matching R2 and Cloudinary. Storage provider conformance now checks both deletion paths, with the Cloudflare mock returning 404 for missing images.

Publish the diagnostic registry with the updated Cloudflare source locations.
