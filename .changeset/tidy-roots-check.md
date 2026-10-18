---
"@croco/architecture-policy": patch
---

Reject source root imports when the package exports map omits or blocks the root entrypoint, while preserving legacy root resolution and subpath-only dependency declarations.
