---
"@croco/framework-context": patch
"@croco/problems-core": patch
---

Keep removed generated DI providers absent during unrelated graph changes and release unowned singletons once. Explicit graph reinstallation restores removed bindings. Synchronize generated diagnostic source locations.
