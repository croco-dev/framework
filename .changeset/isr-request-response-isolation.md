---
"@croco/meta-vite": patch
---

Concurrent ISR requests each receive their own rendered response when the first render returns `Set-Cookie` or `Cache-Control: private` or `no-store`.
