---
"@croco/architecture-policy": patch
---

Apply forbidden-import rules only when the import also matches `from.specifiers`, for both source imports and package manifest dependencies.
