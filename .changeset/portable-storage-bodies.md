---
"@croco/storage-core": major
"@croco/storage-r2": major
"@croco/storage-cloudinary": major
"@croco/storage-cloudflare": major
"@croco/testing": patch
"@croco/problems-core": patch
---

Replace Node-only storage bodies with `Uint8Array` and Web `ReadableStream` contracts, preserve provider-native streaming downloads, and expose Node stream conversion through a separate storage-core subpath.
