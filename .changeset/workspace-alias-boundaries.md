---
"@croco/architecture-policy": patch
"@croco/problems-core": patch
---

Workspace imports through TypeScript paths aliases obey the same package boundary rules as bare and relative imports. App-local aliases remain local, and invalid TypeScript configuration fails with actionable diagnostics.
