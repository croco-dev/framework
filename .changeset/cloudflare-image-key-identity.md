---
"@croco/storage-cloudflare": patch
---

Cloudflare Images uploads now preserve the caller key as the upstream custom image ID, reject unsupported IDs before consuming upload data, validate the returned identity, and encode lifecycle URLs consistently.
