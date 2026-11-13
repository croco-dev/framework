---
"@croco/meta-vite": patch
---

Render a fresh response for each request when ISR encounters `Cache-Control: no-cache`, including concurrent requests and entries already stored by an older version.
