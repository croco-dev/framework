---
"@croco/meta-vite": patch
"@croco/problems-core": patch
---

Register CROCO_META_VITE_SSG_OUTPUT_CONFLICT with build-time recovery instructions. Reject conflicting SSG output paths before rendering instead of returning HTML artifacts that overwrite one another.
