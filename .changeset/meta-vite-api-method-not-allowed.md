---
"@croco/meta-vite": patch
---

Meta fetch handlers now return 405 Method Not Allowed with an Allow header when API route paths exist but do not support the request method.
