---
"@croco/framework-module": minor
"@croco/problems-core": patch
---

Allow callers to create, diagnose, shut down, reset, and dispose isolated module runtimes without sharing module names, lifecycle state, provider instances, or process-global provider fallbacks, while keeping `CrocoModule` as the compatible default-runtime facade.
