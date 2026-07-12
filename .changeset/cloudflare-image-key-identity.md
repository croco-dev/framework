---
"@croco/storage-cloudflare": patch
---

Cloudflare Images uploads now preserve the caller key as the upstream custom image ID, reject unsupported or path-ambiguous IDs before consuming upload data, validate upstream response shapes and returned identities, and encode lifecycle URLs consistently.
