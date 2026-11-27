---
"@croco/tx-drizzle": patch
"@croco/frontend-react": patch
"@croco/esbuild-plugin": patch
---

Mark intentionally unawaited promises in transaction abort tracking and page experience flushing, and name the
discarded bindings in generated DI manifests. Runtime behavior is unchanged.
