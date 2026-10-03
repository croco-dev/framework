---
"@croco/meta-vite": patch
---

Convert non-form-data server action POST bodies to `meta-vite/server-action-invalid-content-type` (415) problem+json instead of propagating the raw `request.formData()` TypeError.
