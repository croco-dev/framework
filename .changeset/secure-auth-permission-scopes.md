---
"@croco/auth-core": patch
---

Prevent object-scoped RBAC grants, including `manage`, from satisfying global or differently scoped permission requirements, and reject empty resource identifiers consistently.
