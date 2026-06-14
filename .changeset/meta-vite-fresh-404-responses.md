---
"@croco/meta-vite": patch
---

Meta fetch handlers now return fresh 404 Response instances for API and page misses so repeated body reads do not fail after an earlier miss.
