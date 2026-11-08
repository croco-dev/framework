---
"@croco/framework-context": patch
"@croco/problems-core": patch
---

Keep removed generated DI providers absent during unrelated graph changes and release shared values after their last binding or active request releases them. Validate graph changes before committing removal or replacement and report all attempted cleanup failures through `framework-context/container-provider-cleanup-failed`. Explicit graph reinstallation restores removed bindings. Preserve runtime replacement baselines during rollback, recheck ownership between destructors, and synchronize diagnostic recovery metadata.
