---
"@croco/diagnostics-core": patch
"@croco/transports-http": patch
"create-croco-app": patch
---

- Generated REST/Lambda and Cloudflare worker apps now bootstrap with the required HTTP security middleware instead of disabling security validation.
- Missing required HTTP security middleware now fails with `CROCO_HTTP_SECURITY_001` while preserving the previous slash-form code as `legacyCode`.
