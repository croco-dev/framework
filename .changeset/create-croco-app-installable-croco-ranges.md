---
"create-croco-app": patch
---

Generated app package manifests now rewrite external `@croco/*` workspace ranges to installable published ranges before dependency installation while preserving generated app-internal workspace dependencies.
