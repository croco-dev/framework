---
"@croco/meta-vite": patch
"@croco/problems-core": patch
---

Convert non-form-data server action POST bodies to `meta-vite/server-action-invalid-content-type` (415) problem+json instead of propagating the raw `request.formData()` TypeError. Malformed bodies that arrive with a form content type now surface as `meta-vite/server-action-malformed-body` (400).
