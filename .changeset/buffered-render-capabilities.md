---
"@croco/meta-vite": patch
"@croco/problems-core": patch
---

Report the legacy `rsc` route as buffered React SSR rather than React Flight or progressive streaming. Keep requested mode and runtime requirements intact, and reject explicitly required page capabilities that the implementation cannot provide. Existing render payloads, status codes, and SSR error observation remain unchanged; consumers relying on the previous capability claims must treat Flight and streaming as unsupported.
